using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Api.Services;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class ReceptionVisitsController(QueueDbContext db, VisitIssuanceService visitIssuance) : ControllerBase
{
    [HttpGet("services/available")]
    [Authorize(Policy = QueueRoles.QueueServices)]
    public async Task<IActionResult> AvailableServices(CancellationToken cancellationToken) =>
        Ok(await db.Services.AsNoTracking()
            .Where(service => service.Active && service.Department.Active)
            .OrderBy(service => service.Department.Name).ThenBy(service => service.Name)
            .Select(service => new AvailableServiceDto(service.Id, service.Name, service.DepartmentId, service.Department.Name, service.Active))
            .ToArrayAsync(cancellationToken));

    [HttpPost("visits")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> Issue(
        [FromBody] IssueVisitRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var userId = VisitCommandSupport.CurrentUserId(User);
        if (userId is null) return Unauthorized();
        var result = await visitIssuance.IssueAsync(request, idempotencyKey, userId, null, HttpContext.TraceIdentifier, cancellationToken);
        if (result.Error is not null) return Problem(statusCode: result.StatusCode, title: result.Error);
        return result.WasReplay ? Ok(result.Receipt) : Created($"/api/v1/visits/{result.Receipt!.Id}", result.Receipt);
    }

    [HttpGet("visits/{id:guid}")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> GetVisit(Guid id, CancellationToken cancellationToken)
    {
        var visit = await db.Visits.AsNoTracking().Include(item => item.CurrentStep)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return visit is null ? NotFound() : Ok(new VisitDto(
            visit.Id, visit.VisitCode, visit.CurrentStep?.DepartmentId, visit.CurrentStep?.State.ToString(),
            visit.CurrentStep?.AppointmentAtUtc, visit.IssuedAtUtc, visit.Completed));
    }

    [HttpGet("reception/visits/receipt")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> FindReceipt(
        [FromQuery] string? visitCode,
        [FromQuery] string? clinicDate,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(visitCode) || !int.TryParse(visitCode, NumberStyles.None, CultureInfo.InvariantCulture, out var sequence) ||
            sequence < 1 || visitCode != sequence.ToString("D3", CultureInfo.InvariantCulture) ||
            !DateOnly.TryParseExact(clinicDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            return Problem(statusCode: 400, title: "Enter a canonical visit code and clinic date (YYYY-MM-DD).");

        var receipt = await (
            from step in db.DepartmentSteps.AsNoTracking()
            join visit in db.Visits.AsNoTracking() on step.VisitId equals visit.Id
            where visit.ClinicDate == date && visit.Sequence == sequence
            orderby step.EnteredAtUtc, step.Id
            select new
            {
                visit.Id,
                visit.VisitCode,
                visit.ClinicDate,
                visit.IssuedAtUtc,
                step.ServiceId,
                ServiceName = step.Service == null ? null : step.Service.Name,
                step.DepartmentId,
                DepartmentName = step.Department.Name,
                step.AppointmentAtUtc,
                step.DepartmentTicketNumber
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (receipt is null) return NotFound();
        return Ok(new IssuedVisitDto(
            receipt.Id, receipt.VisitCode, receipt.ClinicDate, receipt.ServiceId, receipt.ServiceName,
            receipt.DepartmentId, receipt.DepartmentName, receipt.AppointmentAtUtc, receipt.IssuedAtUtc, receipt.DepartmentTicketNumber));
    }
}

public sealed record AvailableServiceDto(Guid Id, string Name, Guid DepartmentId, string DepartmentName, bool Active);
