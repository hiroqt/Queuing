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
public sealed class ReceptionVisitsController(QueueDbContext db, VisitIssuanceService visitIssuance, TimeProvider clock) : ControllerBase
{
    private const int ReceiptSearchLimit = 100;

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

    [HttpPost("reception/visits/receipt-search")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> SearchReceipts([FromBody] ReceiptSearchRequest request, CancellationToken cancellationToken)
    {
        SetNoStore();
        if (!DateOnly.TryParseExact(request.ClinicDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            return Problem(statusCode: 400, title: "Enter a valid clinic date (YYYY-MM-DD).");

        var lookupValue = request.LookupValue?.Trim();
        if (string.IsNullOrWhiteSpace(lookupValue))
            return Problem(statusCode: 400, title: "Enter a visit code or non-identifying reference.");

        int? sequence = null;
        if (string.Equals(request.LookupType, "visitCode", StringComparison.Ordinal))
        {
            if (!int.TryParse(lookupValue, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedSequence) ||
                parsedSequence < 1 || lookupValue.Length > 3 && lookupValue != parsedSequence.ToString("D3", CultureInfo.InvariantCulture))
                return Problem(statusCode: 400, title: "Enter a valid visit code, such as 001.");
            sequence = parsedSequence;
        }
        else if (!string.Equals(request.LookupType, "referenceId", StringComparison.Ordinal))
        {
            return Problem(statusCode: 400, title: "Choose Visit code or Non-identifying reference.");
        }
        else if (lookupValue.Length > 50)
        {
            return Problem(statusCode: 400, title: "Reference cannot exceed 50 characters.");
        }

        var visitsQuery = db.Visits.AsNoTracking().Where(visit => visit.ClinicDate == date);
        visitsQuery = sequence.HasValue
            ? visitsQuery.Where(visit => visit.Sequence == sequence.Value)
            : visitsQuery.Where(visit => visit.ReferenceId == lookupValue);

        var visits = await visitsQuery
            .OrderByDescending(visit => visit.IssuedAtUtc)
            .ThenByDescending(visit => visit.Sequence)
            .Take(ReceiptSearchLimit + 1)
            .Select(visit => new ReceiptVisitSearchRow(visit.Id, visit.VisitCode, visit.ClinicDate, visit.IssuedAtUtc, visit.Sequence))
            .ToArrayAsync(cancellationToken);

        var truncated = visits.Length > ReceiptSearchLimit;
        if (truncated) visits = visits[..ReceiptSearchLimit];
        var visitIds = visits.Select(visit => visit.Id).ToArray();
        var steps = await (
                from step in db.DepartmentSteps.AsNoTracking()
                where visitIds.Contains(step.VisitId)
                orderby step.EnteredAtUtc, step.Id
                select new ReceiptStepSearchRow(
                    step.VisitId,
                    step.ServiceId,
                    step.Service == null ? null : step.Service.Name,
                    step.DepartmentId,
                    step.Department.Name,
                    step.AppointmentAtUtc,
                    step.DepartmentTicketNumber,
                    step.EnteredAtUtc,
                    step.Id))
            .ToArrayAsync(cancellationToken);
        var originalSteps = steps
            .GroupBy(step => step.VisitId)
            .ToDictionary(group => group.Key, group => group.First());
        var matches = visits
            .Where(visit => originalSteps.ContainsKey(visit.Id))
            .Select(visit =>
            {
                var step = originalSteps[visit.Id];
                return new ReceiptMatchDto(
                    visit.Id, visit.VisitCode, visit.ClinicDate, step.ServiceId, step.ServiceName,
                    step.DepartmentId, step.DepartmentName, step.AppointmentAtUtc,
                    visit.IssuedAtUtc, step.DepartmentTicketNumber);
            })
            .ToArray();

        var actorUserId = VisitCommandSupport.CurrentUserId(User);
        foreach (var match in matches)
        {
            VisitCommandSupport.AddAudit(db, clock, actorUserId, HttpContext.TraceIdentifier, "visit.receipt.search", "visit", match.Id);
        }
        if (matches.Length > 0) await db.SaveChangesAsync(cancellationToken);

        return Ok(new ReceiptSearchResponse(matches, truncated));
    }

    [HttpGet("reception/visits/{id:guid}/receipt")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> GetReceipt(Guid id, CancellationToken cancellationToken)
    {
        SetNoStore();
        var receipt = await OriginalReceiptQuery()
            .Where(item => item.Id == id)
            .OrderBy(item => item.EnteredAtUtc).ThenBy(item => item.StepId)
            .FirstOrDefaultAsync(cancellationToken);
        if (receipt is null) return NotFound();

        var userId = VisitCommandSupport.CurrentUserId(User);
        VisitCommandSupport.AddAudit(db, clock, userId, HttpContext.TraceIdentifier, "visit.reprinted", "visit", receipt.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToReceipt(receipt));
    }

    // Kept for existing clients that look up by the printed clinic visit code.
    [HttpGet("reception/visits/receipt")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> FindReceipt(
        [FromQuery] string? visitCode,
        [FromQuery] string? clinicDate,
        CancellationToken cancellationToken)
    {
        SetNoStore();
        if (!DateOnly.TryParseExact(clinicDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            return Problem(statusCode: 400, title: "Enter a valid clinic date (YYYY-MM-DD).");
        if (!int.TryParse(visitCode, NumberStyles.None, CultureInfo.InvariantCulture, out var sequence) ||
            sequence < 1 || visitCode != sequence.ToString("D3", CultureInfo.InvariantCulture))
            return Problem(statusCode: 400, title: "Enter a canonical visit code (e.g. 001).");

        var receipt = await OriginalReceiptQuery()
            .Where(item => item.ClinicDate == date && item.Sequence == sequence)
            .OrderBy(item => item.EnteredAtUtc).ThenBy(item => item.StepId)
            .FirstOrDefaultAsync(cancellationToken);
        if (receipt is null) return NotFound();

        var userId = VisitCommandSupport.CurrentUserId(User);
        VisitCommandSupport.AddAudit(db, clock, userId, HttpContext.TraceIdentifier, "visit.reprinted", "visit", receipt.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToReceipt(receipt));
    }

    private IQueryable<OriginalReceiptRow> OriginalReceiptQuery() =>
        from step in db.DepartmentSteps.AsNoTracking()
        join visit in db.Visits.AsNoTracking() on step.VisitId equals visit.Id
        select new OriginalReceiptRow(
            visit.Id, visit.VisitCode, visit.Sequence, visit.ClinicDate, visit.IssuedAtUtc,
            step.ServiceId, step.Service == null ? null : step.Service.Name,
            step.DepartmentId, step.Department.Name, step.AppointmentAtUtc,
            step.DepartmentTicketNumber, step.EnteredAtUtc, step.Id);

    private void SetNoStore() => Response.Headers.CacheControl = "no-store";

    private static IssuedVisitDto ToReceipt(OriginalReceiptRow receipt) => new(
        receipt.Id, receipt.VisitCode, receipt.ClinicDate, receipt.ServiceId, receipt.ServiceName,
        receipt.DepartmentId, receipt.DepartmentName, receipt.AppointmentAtUtc,
        receipt.IssuedAtUtc, receipt.DepartmentTicketNumber, IsReprint: true);
}

public sealed record AvailableServiceDto(Guid Id, string Name, Guid DepartmentId, string DepartmentName, bool Active);
public sealed record ReceiptSearchRequest(string? LookupType, string? LookupValue, string? ClinicDate);
public sealed record ReceiptSearchResponse(IReadOnlyList<ReceiptMatchDto> Matches, bool Truncated);
public sealed record ReceiptMatchDto(Guid Id, string VisitCode, DateOnly ClinicDate, Guid? ServiceId, string? ServiceName, Guid DepartmentId, string DepartmentName, DateTimeOffset? AppointmentAtUtc, DateTimeOffset IssuedAtUtc, int? DepartmentTicketNumber)
{
    public string TicketNumber => DepartmentTicketNumber?.ToString("D3", CultureInfo.InvariantCulture) ?? VisitCode;
}
internal sealed record ReceiptVisitSearchRow(Guid Id, string VisitCode, DateOnly ClinicDate, DateTimeOffset IssuedAtUtc, int Sequence);
internal sealed record ReceiptStepSearchRow(Guid VisitId, Guid? ServiceId, string? ServiceName, Guid DepartmentId, string DepartmentName, DateTimeOffset? AppointmentAtUtc, int? DepartmentTicketNumber, DateTimeOffset EnteredAtUtc, Guid Id);
internal sealed record OriginalReceiptRow(Guid Id, string VisitCode, int Sequence, DateOnly ClinicDate, DateTimeOffset IssuedAtUtc, Guid? ServiceId, string? ServiceName, Guid DepartmentId, string DepartmentName, DateTimeOffset? AppointmentAtUtc, int? DepartmentTicketNumber, DateTimeOffset EnteredAtUtc, Guid StepId);
