using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Queuing.Api.Hubs;
using Queuing.Api.Models;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class QueueController(QueueDemoStore queue, IHubContext<QueueHub> hubContext) : ControllerBase
{
    [HttpGet("services")]
    public ActionResult<IReadOnlyList<DemoService>> GetServices() => Ok(queue.GetServices());

    [HttpPost("tickets")]
    public IActionResult IssueTicket(
        [FromBody] IssueTicketRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        if (!Guid.TryParse(idempotencyKey, out var key) || key == Guid.Empty)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A valid Idempotency-Key header is required.");
        }

        var result = queue.Issue(request.ServiceId, key);
        return result.Status switch
        {
            IssueStatus.Created => CreatedAtAction(nameof(GetTicket), new { id = result.Ticket!.Id }, result.Ticket),
            IssueStatus.Replayed => Ok(result.Ticket),
            IssueStatus.InvalidService => Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose an available service."),
            IssueStatus.IdempotencyConflict => Problem(statusCode: StatusCodes.Status409Conflict, title: "This issue request key was already used for another service."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError)
        };
    }

    [HttpGet("tickets/{id:guid}")]
    public ActionResult<DemoTicket> GetTicket(Guid id)
    {
        var ticket = queue.GetTicket(id);
        return ticket is null ? NotFound() : Ok(ticket);
    }

    [HttpGet("queue/display")]
    public ActionResult<QueueDisplaySnapshot> GetDisplaySnapshot() => Ok(queue.GetDisplaySnapshot());

    [HttpPost("queue/call-next")]
    public async Task<IActionResult> CallNext(
        [FromBody] CallTicketRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        if (!Guid.TryParse(idempotencyKey, out var key) || key == Guid.Empty)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "A valid Idempotency-Key header is required.");
        }

        var counterName = string.IsNullOrWhiteSpace(request.CounterName) ? "Counter 01" : request.CounterName.Trim();
        var result = queue.CallNext(request.ServiceId, counterName, key);
        if (result.Status is CallStatus.Called or CallStatus.Replayed)
        {
            var dto = QueueItemDto.FromCore(result.Item!);
            await hubContext.Clients.All.SendAsync("TicketCalled", dto, HttpContext.RequestAborted);
            return Ok(dto);
        }

        return result.Status switch
        {
            CallStatus.InvalidService => Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose an available service."),
            CallStatus.NoWaitingTicket => Problem(statusCode: StatusCodes.Status409Conflict, title: "No waiting ticket is available for the selected service."),
            CallStatus.IdempotencyConflict => Problem(statusCode: StatusCodes.Status409Conflict, title: "This call request key was already used for another request."),
            _ => Problem(statusCode: StatusCodes.Status500InternalServerError)
        };
    }
}

public sealed record IssueTicketRequest(string ServiceId);
public sealed record CallTicketRequest(string ServiceId, string? CounterName);
