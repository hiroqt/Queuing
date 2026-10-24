using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Data;
using Queuing.Api.Hubs;

namespace Queuing.Api.Services;

public sealed class QueueOutboxDispatcher(
    IServiceScopeFactory scopeFactory,
    IHubContext<QueueHub> hub,
    ILogger<QueueOutboxDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchBatch(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Queue notification dispatch failed; the next poll will retry.");
            }

            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }

    private async Task DispatchBatch(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<QueueDbContext>();
        var batch = await db.OutboxMessages.Where(message => message.PublishedAtUtc == null)
            .OrderBy(message => message.CreatedAtUtc).Take(25).ToArrayAsync(cancellationToken);
        foreach (var message in batch)
        {
            var displayIds = await db.DisplayDevices.AsNoTracking()
                .Where(device => device.Active && device.CredentialHash != null && device.DepartmentId == message.DepartmentId)
                .Select(device => new { device.Id, device.CredentialHash })
                .ToArrayAsync(cancellationToken);
            foreach (var display in displayIds)
            {
                await hub.Clients.Group(QueueHub.DisplayGroupName(display.Id, display.CredentialHash!))
                    .SendAsync("QueueChanged", cancellationToken);
            }
            await NotifyLobbyDisplaysAsync(db, hub, cancellationToken);
            message.PublishedAtUtc = DateTimeOffset.UtcNow;
        }
        if (batch.Length > 0) await db.SaveChangesAsync(cancellationToken);
    }

    public static async Task NotifyLobbyDisplaysAsync(QueueDbContext db, IHubContext<QueueHub> hub, CancellationToken cancellationToken)
    {
        var displayIds = await db.DisplayDevices.AsNoTracking()
            .Where(device => device.DepartmentId == null && device.Active && device.CredentialHash != null)
            .Select(device => new { device.Id, device.CredentialHash })
            .ToArrayAsync(cancellationToken);
        foreach (var display in displayIds)
            // shortcut: one in-flight invalidation may reach a just-revoked generation; it carries no queue data, upgrade to server-side connection eviction if that must be prevented.
            await hub.Clients.Group(QueueHub.DisplayGroupName(display.Id, display.CredentialHash!)).SendAsync("QueueChanged", cancellationToken);
    }
}
