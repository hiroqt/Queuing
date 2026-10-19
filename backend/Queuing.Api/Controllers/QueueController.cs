using Microsoft.AspNetCore.Mvc;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class QueueController(QueueDemoStore queue) : ControllerBase
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
}

public sealed record IssueTicketRequest(string ServiceId);
