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

    public async Task CallTicket(CallTicketRequest request)
    {
        var item = queueStore.CallNext(request.Department ?? "Consultation", request.CounterName ?? "Counter 01");
        var dto = QueueItemDto.FromCore(item);
        await Clients.All.SendAsync("TicketCalled", dto);
    }

    public async Task RecallTicket(RecallTicketRequest request)
    {
        var item = queueStore.RecallTicket(request.TicketNumber, request.CounterName ?? "Counter 01");
        var dto = QueueItemDto.FromCore(item);
        await Clients.All.SendAsync("TicketRecalled", dto);
    }
}
