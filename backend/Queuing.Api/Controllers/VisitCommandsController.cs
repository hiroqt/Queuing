using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Api.Services;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class VisitCommandsController(QueueDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet("departments/{departmentId:guid}/queue")]
    [Authorize(Policy = QueueRoles.Staff)]
    public async Task<IActionResult> GetDepartmentQueue(Guid departmentId, CancellationToken cancellationToken)
    {
        if (!await DepartmentScope.CanAccessAsync(User, departmentId, db, cancellationToken)) return Forbid();
        var department = await db.Departments.AsNoTracking().SingleAsync(item => item.Id == departmentId, cancellationToken);
        var visits = await db.DepartmentSteps.AsNoTracking()
            .Where(step => step.DepartmentId == departmentId && step.Visit.CurrentStepId == step.Id &&
                (step.State == DepartmentStepState.Pending || step.State == DepartmentStepState.Called))
            .Include(step => step.Visit)
            .OrderBy(step => step.State)
            .ThenBy(step => step.AppointmentAtUtc == null)
            .ThenBy(step => step.AppointmentAtUtc)
            .ThenBy(step => step.EnteredAtUtc)
            .ThenBy(step => step.Visit.ClinicDate)
            .ThenBy(step => step.Visit.Sequence)
            .Select(step => new QueueVisitDto(
                step.Visit.Id,
                step.Visit.VisitCode,
                departmentId,
                step.State.ToString(),
                step.AppointmentAtUtc,
                step.Visit.IssuedAtUtc,
                step.CalledAtUtc))
            .ToArrayAsync(cancellationToken);
        var now = clock.GetUtcNow();
        return Ok(new DepartmentQueueDto(
            department.Name,
            visits.Where(visit => visit.Status == nameof(DepartmentStepState.Pending)).Select(visit => visit with
            {
                IsEligible = DepartmentQueuePolicy.IsAppointmentEligible(visit.AppointmentAtUtc, now)
            }).ToArray(),
            visits.Where(visit => visit.Status == nameof(DepartmentStepState.Called)).ToArray()));
    }

    [HttpPost("departments/{departmentId:guid}/call-next")]
    [Authorize(Policy = QueueRoles.Staff)]
    public async Task<IActionResult> CallNext(
        Guid departmentId,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var key = VisitCommandSupport.ParseIdempotencyKey(idempotencyKey);
        if (key is null) return Problem(statusCode: 400, title: "A valid Idempotency-Key is required.");
        if (!await DepartmentScope.CanAccessAsync(User, departmentId, db, cancellationToken)) return Forbid();

        var userId = VisitCommandSupport.CurrentUserId(User);
        if (userId is null) return Unauthorized();
        var scope = $"queue.call:{userId}:{departmentId}";
        const string requestHash = "call-next";
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var replay = await VisitCommandSupport.FindReplayAsync<QueueVisitDto>(db, scope, key, requestHash, cancellationToken);
        if (replay.Conflict) return Problem(statusCode: 409, title: "This idempotency key was already used for another request.");
        if (replay.Value is not null) return Ok(replay.Value);

        var now = clock.GetUtcNow();
        var candidates = await db.DepartmentSteps.FromSqlInterpolated($"""
                SELECT `step`.*
                FROM `DepartmentSteps` AS `step`
                INNER JOIN `Visits` AS `visit` ON `visit`.`CurrentStepId` = `step`.`Id`
                WHERE `step`.`DepartmentId` = {departmentId}
                    AND `step`.`State` = 'Pending'
                    AND (`step`.`AppointmentAtUtc` IS NULL OR `step`.`AppointmentAtUtc` <= {now})
                ORDER BY (`step`.`AppointmentAtUtc` IS NULL), `step`.`AppointmentAtUtc`, `step`.`EnteredAtUtc`, `visit`.`ClinicDate`, `visit`.`Sequence`
                LIMIT 1 FOR UPDATE SKIP LOCKED
                """)
            .AsTracking().ToListAsync(cancellationToken);
        var candidate = candidates.SingleOrDefault();
        if (candidate is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Problem(statusCode: 409, title: "No eligible visit is waiting in this department.");
        }

        var visit = await db.Visits.SingleAsync(item => item.Id == candidate.VisitId, cancellationToken);
        candidate.State = DepartmentStepState.Called;
        candidate.CalledAtUtc = now;
        var dto = new QueueVisitDto(visit.Id, visit.VisitCode, departmentId, nameof(DepartmentStepState.Called), candidate.AppointmentAtUtc, visit.IssuedAtUtc, now);
        VisitCommandSupport.SaveCommand(db, clock, scope, key, requestHash, candidate.Id, dto);
        VisitCommandSupport.AddAudit(db, clock, userId, HttpContext.TraceIdentifier, "visit.called", "visit", visit.Id);
        VisitCommandSupport.AddOutbox(db, clock, visit.Id, departmentId);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(dto);
    }

    [HttpPost("visits/{id:guid}/return-to-pending")]
    [Authorize(Policy = QueueRoles.Staff)]
    public async Task<IActionResult> ReturnToPending(
        Guid id,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var key = VisitCommandSupport.ParseIdempotencyKey(idempotencyKey);
        if (key is null) return Problem(statusCode: 400, title: "A valid Idempotency-Key is required.");
        var userId = VisitCommandSupport.CurrentUserId(User);
        if (userId is null) return Unauthorized();
        const string requestHash = "return-to-pending";
        var scope = $"visit.no-show:{userId}:{id}";
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var replay = await VisitCommandSupport.FindReplayAsync<QueueVisitDto>(db, scope, key, requestHash, cancellationToken);
        if (replay.Conflict) return Problem(statusCode: 409, title: "This idempotency key was already used for another request.");
        if (replay.Value is not null) return Ok(replay.Value);

        var visit = await db.Visits.Include(item => item.CurrentStep).SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (visit?.CurrentStep is null) return NotFound();
        if (!await DepartmentScope.CanAccessAsync(User, visit.CurrentStep.DepartmentId, db, cancellationToken)) return Forbid();
        if (!DepartmentQueuePolicy.CanReturnToPending(visit.CurrentStep.State))
        {
            return Problem(statusCode: 409, title: "Only a currently called visit can be returned to pending.");
        }

        var step = visit.CurrentStep;
        var changed = await db.DepartmentSteps.Where(item => item.Id == step.Id && item.State == DepartmentStepState.Called)
            .ExecuteUpdateAsync(update => update
                .SetProperty(item => item.State, DepartmentStepState.Pending)
                .SetProperty(item => item.CalledAtUtc, (DateTimeOffset?)null), cancellationToken);
        if (changed != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Problem(statusCode: 409, title: "This visit was already changed by another staff action.");
        }
        step.State = DepartmentStepState.Pending;
        step.CalledAtUtc = null;
        var dto = new QueueVisitDto(visit.Id, visit.VisitCode, step.DepartmentId, nameof(DepartmentStepState.Pending), step.AppointmentAtUtc, visit.IssuedAtUtc, null);
        VisitCommandSupport.SaveCommand(db, clock, scope, key, requestHash, step.Id, dto);
        VisitCommandSupport.AddAudit(db, clock, userId, HttpContext.TraceIdentifier, "visit.returned-to-pending", "visit", visit.Id);
        VisitCommandSupport.AddOutbox(db, clock, visit.Id, step.DepartmentId);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(dto);
    }

    [HttpPost("visits/{id:guid}/complete")]
    [Authorize(Policy = QueueRoles.Staff)]
    public async Task<IActionResult> Complete(
        Guid id,
        [FromBody] CompleteVisitRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var key = VisitCommandSupport.ParseIdempotencyKey(idempotencyKey);
        if (key is null) return Problem(statusCode: 400, title: "A valid Idempotency-Key is required.");
        var nextAppointmentAtUtc = VisitCommandSupport.ParseClinicLocalTime(request.NextDepartmentAppointmentAtLocal);
        if (nextAppointmentAtUtc.IsInvalid)
        {
            return Problem(statusCode: 400, title: "Appointment time must use YYYY-MM-DDTHH:mm in the clinic timezone.");
        }

        var userId = VisitCommandSupport.CurrentUserId(User);
        if (userId is null) return Unauthorized();
        var requestHash = VisitCommandSupport.Hash(JsonSerializer.Serialize(request));
        var scope = $"visit.complete:{userId}:{id}";
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var replay = await VisitCommandSupport.FindReplayAsync<CompleteVisitDto>(db, scope, key, requestHash, cancellationToken);
        if (replay.Conflict) return Problem(statusCode: 409, title: "This idempotency key was already used for another request.");
        if (replay.Value is not null) return Ok(replay.Value);

        var visit = await db.Visits.Include(item => item.CurrentStep).SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (visit?.CurrentStep is null) return NotFound();
        var currentStep = visit.CurrentStep;
        if (!await DepartmentScope.CanAccessAsync(User, currentStep.DepartmentId, db, cancellationToken)) return Forbid();
        if (!DepartmentQueuePolicy.CanComplete(currentStep.State))
        {
            return Problem(statusCode: 409, title: "Only a currently called visit can be completed or forwarded.");
        }
        var nextService = request.NextServiceId is { } nextServiceId
            ? await db.Services.AsNoTracking().Where(service => service.Id == nextServiceId && service.Active && service.Department.Active)
                .Select(service => new { service.Id, service.DepartmentId }).SingleOrDefaultAsync(cancellationToken)
            : null;
        if (request.NextServiceId.HasValue && nextService is null)
        {
            return Problem(statusCode: 400, title: "Choose an active next service.");
        }
        if (request.NextServiceId is null && request.NextDepartmentAppointmentAtLocal is not null)
        {
            return Problem(statusCode: 400, title: "A next-service appointment requires a next service.");
        }

        var now = clock.GetUtcNow();
        var changed = await db.DepartmentSteps.Where(item => item.Id == currentStep.Id && item.State == DepartmentStepState.Called)
            .ExecuteUpdateAsync(update => update
                .SetProperty(item => item.State, DepartmentStepState.Completed)
                .SetProperty(item => item.CompletedAtUtc, (DateTimeOffset?)now), cancellationToken);
        if (changed != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Problem(statusCode: 409, title: "This visit was already changed by another staff action.");
        }
        currentStep.State = DepartmentStepState.Completed;
        currentStep.CompletedAtUtc = now;
        Guid? nextStepId = null;
        if (nextService is not null)
        {
            var nextStep = new DepartmentStep
            {
                VisitId = visit.Id,
                DepartmentId = nextService.DepartmentId,
                ServiceId = nextService.Id,
                AppointmentAtUtc = nextAppointmentAtUtc.Value,
                State = DepartmentStepState.Pending,
                EnteredAtUtc = now
            };
            db.DepartmentSteps.Add(nextStep);
            await db.SaveChangesAsync(cancellationToken);
            visit.CurrentStepId = nextStep.Id;
            nextStepId = nextStep.Id;
        }
        else
        {
            visit.CurrentStepId = null;
            visit.Completed = true;
        }

        var dto = new CompleteVisitDto(visit.Id, visit.VisitCode, visit.Completed, nextService?.DepartmentId, nextService?.Id);
        VisitCommandSupport.SaveCommand(db, clock, scope, key, requestHash, nextStepId ?? currentStep.Id, dto);
        VisitCommandSupport.AddAudit(db, clock, userId, HttpContext.TraceIdentifier, visit.Completed ? "visit.completed" : "visit.forwarded", "visit", visit.Id);
        VisitCommandSupport.AddOutbox(db, clock, visit.Id, currentStep.DepartmentId);
        if (nextService is not null) VisitCommandSupport.AddOutbox(db, clock, visit.Id, nextService.DepartmentId);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(dto);
    }

}

public sealed record CompleteVisitRequest(Guid? NextServiceId, string? NextDepartmentAppointmentAtLocal);
public sealed record VisitDto(Guid Id, string VisitCode, Guid? DepartmentId, string? Status, DateTimeOffset? AppointmentAtUtc, DateTimeOffset IssuedAtUtc, bool Completed);
public sealed record QueueVisitDto(Guid Id, string VisitCode, Guid DepartmentId, string Status, DateTimeOffset? AppointmentAtUtc, DateTimeOffset IssuedAtUtc, DateTimeOffset? CalledAtUtc, bool IsEligible = true);
public sealed record DepartmentQueueDto(string DepartmentName, QueueVisitDto[] Waiting, QueueVisitDto[] Called);
public sealed record CompleteVisitDto(Guid Id, string VisitCode, bool Completed, Guid? NextDepartmentId, Guid? NextServiceId);
