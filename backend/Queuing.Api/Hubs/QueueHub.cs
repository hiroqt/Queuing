using Microsoft.AspNetCore.SignalR;
using Queuing.Api.Models;
using Queuing.Core;

namespace Queuing.Api.Hubs;

public sealed class QueueHub(QueueDemoStore queueStore) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var snapshot = queueStore.GetActiveDisplayQueue()
            .Select(QueueItemDto.FromCore);
        await Clients.Caller.SendAsync("QueueStateSnapshot", snapshot);
        await base.OnConnectedAsync();
    }

    public Task<IEnumerable<QueueItemDto>> GetSnapshot()
    {
        var snapshot = queueStore.GetActiveDisplayQueue()
            .Select(QueueItemDto.FromCore);
        return Task.FromResult(snapshot);
    }

}
