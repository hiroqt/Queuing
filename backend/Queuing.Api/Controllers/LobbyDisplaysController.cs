using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Data;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/displays/me")]
[Authorize(Policy = "DisplayDevice")]
public sealed class LobbyDisplaysController(QueueDbContext db) : ControllerBase
{
    [HttpGet("lobby-snapshot")]
    public async Task<IActionResult> Snapshot(CancellationToken cancellationToken)
    {
        if (User.FindFirst("display_type")?.Value != "Lobby") return Forbid();

        var departments = await db.Departments.AsNoTracking().Where(department => department.Active)
            .OrderBy(department => department.Name)
            .Select(department => new { department.Id, department.Name })
            .ToArrayAsync(cancellationToken);
        var result = new List<LobbyDepartmentSnapshot>(departments.Length);
        foreach (var department in departments)
        {
            var called = await db.DepartmentSteps.AsNoTracking()
                .Where(step => step.DepartmentId == department.Id && step.Visit.CurrentStepId == step.Id && step.State == DepartmentStepState.Called)
                .OrderByDescending(step => step.CalledAtUtc)
                .ThenByDescending(step => step.Visit.Sequence)
                .Select(step => new DepartmentQueueTicket(step.DepartmentTicketNumber, step.Visit.VisitCode))
                .FirstOrDefaultAsync(cancellationToken);
            var waiting = await db.DepartmentSteps.AsNoTracking()
                .Where(step => step.DepartmentId == department.Id && step.Visit.CurrentStepId == step.Id && step.State == DepartmentStepState.Pending)
                .OrderBy(step => step.AppointmentAtUtc == null)
                .ThenBy(step => step.AppointmentAtUtc)
                .ThenBy(step => step.EnteredAtUtc)
                .ThenBy(step => step.Visit.ClinicDate)
                .ThenBy(step => step.Visit.Sequence)
                .Select(step => new DepartmentQueueTicket(step.DepartmentTicketNumber, step.Visit.VisitCode))
                .Take(3)
                .ToArrayAsync(cancellationToken);
            result.Add(new LobbyDepartmentSnapshot(department.Name, called?.TicketNumber, waiting.Select(ticket => ticket.TicketNumber).ToArray()));
        }
        return Ok(result);
    }

    [HttpGet("videos")]
    public async Task<IActionResult> Videos(CancellationToken cancellationToken)
    {
        if (User.FindFirst("display_type")?.Value != "Lobby") return Forbid();
        return Ok(await db.DisplayVideos.AsNoTracking().OrderBy(video => video.CreatedAtUtc).ThenBy(video => video.Id)
            .Select(video => new LobbyVideoDto(video.Id,
                video.StorageKey == null ? video.Url! : $"/api/v1/displays/me/videos/{video.Id}/content"))
            .ToArrayAsync(cancellationToken));
    }

    [HttpGet("videos/{id:guid}/content")]
    public async Task<IActionResult> Video(Guid id, [FromServices] IConfiguration configuration,
        [FromServices] IWebHostEnvironment environment, CancellationToken cancellationToken)
    {
        if (User.FindFirst("display_type")?.Value != "Lobby") return Forbid();
        var video = await db.DisplayVideos.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (video?.StorageKey is null) return NotFound();
        var path = DisplayVideoStorage.PathFor(configuration, environment, video.StorageKey);
        if (!System.IO.File.Exists(path)) return NotFound();
        return PhysicalFile(path, video.ContentType, enableRangeProcessing: true);
    }
}

public sealed record LobbyDepartmentSnapshot(string DepartmentName, string? Called, string[] Waiting);
public sealed record DepartmentQueueTicket(int? DepartmentTicketNumber, string VisitCode)
{
    public string TicketNumber => DepartmentTicketNumber?.ToString("D3", System.Globalization.CultureInfo.InvariantCulture) ?? VisitCode;
}
public sealed record LobbyVideoDto(Guid Id, string Url);
