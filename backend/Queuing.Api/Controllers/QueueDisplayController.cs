using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Queuing.Api.Hubs;
using Queuing.Api.Models;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/queue/display")]
public sealed class QueueDisplayController(
    QueueDemoStore queueStore,
    IHubContext<QueueHub> hubContext) : ControllerBase
{
    [HttpGet]
    public ActionResult<IEnumerable<QueueItemDto>> GetDisplaySnapshot([FromQuery] string? department)
    {
        var items = queueStore.GetActiveDisplayQueue()
            .Select(QueueItemDto.FromCore);

        if (!string.IsNullOrWhiteSpace(department) && !string.Equals(department, "all", StringComparison.OrdinalIgnoreCase))
        {
            items = items.Where(i => string.Equals(i.Department, department, StringComparison.OrdinalIgnoreCase));
        }

        return Ok(items);
    }

    [HttpPost("call")]
    public async Task<ActionResult<QueueItemDto>> CallTicket([FromBody] CallTicketRequest? request)
    {
        var department = request?.Department ?? "Consultation";
        var counter = request?.CounterName ?? "Counter 01";
        var item = queueStore.CallNext(department, counter);
        var dto = QueueItemDto.FromCore(item);

        await hubContext.Clients.All.SendAsync("TicketCalled", dto);
        return Ok(dto);
    }

    [HttpPost("recall")]
    public async Task<ActionResult<QueueItemDto>> RecallTicket([FromBody] RecallTicketRequest request)
    {
        var item = queueStore.RecallTicket(request.TicketNumber, request.CounterName ?? "Counter 01");
        var dto = QueueItemDto.FromCore(item);

        await hubContext.Clients.All.SendAsync("TicketRecalled", dto);
        return Ok(dto);
    }
}
