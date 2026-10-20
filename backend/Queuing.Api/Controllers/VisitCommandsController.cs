using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class VisitCommandsController(QueueDbContext db, TimeProvider clock) : ControllerBase
{
    private static readonly TimeZoneInfo ClinicTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

    [HttpPost("visits")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> Issue(
        [FromBody] IssueVisitRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var key = ParseIdempotencyKey(idempotencyKey);
        if (key is null) return Problem(statusCode: 400, title: "A valid Idempotency-Key is required.");
        var appointmentAtUtc = ParseClinicLocalTime(request.AppointmentAtLocal);
        if (appointmentAtUtc.IsInvalid)
        {
            return Problem(statusCode: 400, title: "Appointment time must use YYYY-MM-DDTHH:mm in the clinic timezone.");
        }
        if (!await db.Departments.AnyAsync(department => department.Id == request.InitialDepartmentId && department.Active, cancellationToken))
        {
            return Problem(statusCode: 400, title: "Choose an active department.");
        }

        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        var scope = $"visit.issue:{userId}";
        var requestHash = Hash(JsonSerializer.Serialize(request));
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var replay = await FindReplayAsync<IssuedVisitDto>(scope, key, requestHash, cancellationToken);
        if (replay.Conflict) return Problem(statusCode: 409, title: "This idempotency key was already used for another request.");
        if (replay.Value is not null) return Ok(replay.Value);

        var now = clock.GetUtcNow();
        var clinicDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, ClinicTimeZone).DateTime);
        var clinicDateValue = clinicDate.ToDateTime(TimeOnly.MinValue);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT IGNORE INTO `DailySequences` (`ClinicDate`, `LastSequence`) VALUES ({clinicDateValue}, 0)", cancellationToken);
        var dailySequence = await db.DailySequences.FromSqlInterpolated(
                $"SELECT * FROM `DailySequences` WHERE `ClinicDate` = {clinicDateValue} FOR UPDATE")
            .SingleAsync(cancellationToken);
        dailySequence.LastSequence++;

        var visit = new Visit
        {
            ClinicDate = clinicDate,
            Sequence = dailySequence.LastSequence,
            VisitCode = dailySequence.LastSequence.ToString("D3", CultureInfo.InvariantCulture),
            IssuedByUserId = userId.Value,
            IssuedAtUtc = now
        };
        db.Visits.Add(visit);
        await db.SaveChangesAsync(cancellationToken);

        var step = new DepartmentStep
        {
            VisitId = visit.Id,
            DepartmentId = request.InitialDepartmentId,
            AppointmentAtUtc = appointmentAtUtc.Value,
            State = DepartmentStepState.Pending,
            EnteredAtUtc = now
        };
        db.DepartmentSteps.Add(step);
        await db.SaveChangesAsync(cancellationToken);
        visit.CurrentStepId = step.Id;
        var dto = new IssuedVisitDto(visit.Id, visit.VisitCode, request.InitialDepartmentId, step.AppointmentAtUtc, visit.IssuedAtUtc);
        SaveCommand(scope, key, requestHash, visit.Id, dto);
        AddAudit("visit.issued", "visit", visit.Id);
        AddOutbox(visit.Id, request.InitialDepartmentId);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Created($"/api/v1/visits/{visit.Id}", dto);
    }

    [HttpGet("visits/{id:guid}")]
    [Authorize(Policy = QueueRoles.Reception)]
    public async Task<IActionResult> GetVisit(Guid id, CancellationToken cancellationToken)
    {
        var visit = await db.Visits.AsNoTracking().Include(item => item.CurrentStep)
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return visit is null ? NotFound() : Ok(ToVisitDto(visit));
    }

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
        var key = ParseIdempotencyKey(idempotencyKey);
        if (key is null) return Problem(statusCode: 400, title: "A valid Idempotency-Key is required.");
        if (!await DepartmentScope.CanAccessAsync(User, departmentId, db, cancellationToken)) return Forbid();

        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        var scope = $"queue.call:{userId}:{departmentId}";
        const string requestHash = "call-next";
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var replay = await FindReplayAsync<QueueVisitDto>(scope, key, requestHash, cancellationToken);
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
        SaveCommand(scope, key, requestHash, candidate.Id, dto);
        AddAudit("visit.called", "visit", visit.Id);
        AddOutbox(visit.Id, departmentId);
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
        var key = ParseIdempotencyKey(idempotencyKey);
        if (key is null) return Problem(statusCode: 400, title: "A valid Idempotency-Key is required.");
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        const string requestHash = "return-to-pending";
        var scope = $"visit.no-show:{userId}:{id}";
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var replay = await FindReplayAsync<QueueVisitDto>(scope, key, requestHash, cancellationToken);
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
        SaveCommand(scope, key, requestHash, step.Id, dto);
        AddAudit("visit.returned-to-pending", "visit", visit.Id);
        AddOutbox(visit.Id, step.DepartmentId);
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
        var key = ParseIdempotencyKey(idempotencyKey);
        if (key is null) return Problem(statusCode: 400, title: "A valid Idempotency-Key is required.");
        var nextAppointmentAtUtc = ParseClinicLocalTime(request.NextDepartmentAppointmentAtLocal);
        if (nextAppointmentAtUtc.IsInvalid)
        {
            return Problem(statusCode: 400, title: "Appointment time must use YYYY-MM-DDTHH:mm in the clinic timezone.");
        }

        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        var requestHash = Hash(JsonSerializer.Serialize(request));
        var scope = $"visit.complete:{userId}:{id}";
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var replay = await FindReplayAsync<CompleteVisitDto>(scope, key, requestHash, cancellationToken);
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
        if (request.NextDepartmentId is { } nextDepartmentId &&
            !await db.Departments.AnyAsync(department => department.Id == nextDepartmentId && department.Active, cancellationToken))
        {
            return Problem(statusCode: 400, title: "Choose an active next department.");
        }
        if (request.NextDepartmentId is null && request.NextDepartmentAppointmentAtLocal is not null)
        {
            return Problem(statusCode: 400, title: "A next-department appointment requires a next department.");
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
        if (request.NextDepartmentId is { } destinationDepartmentId)
        {
            var nextStep = new DepartmentStep
            {
                VisitId = visit.Id,
                DepartmentId = destinationDepartmentId,
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

        var dto = new CompleteVisitDto(visit.Id, visit.VisitCode, visit.Completed, request.NextDepartmentId);
        SaveCommand(scope, key, requestHash, nextStepId ?? currentStep.Id, dto);
        AddAudit(visit.Completed ? "visit.completed" : "visit.forwarded", "visit", visit.Id);
        AddOutbox(visit.Id, currentStep.DepartmentId);
        if (request.NextDepartmentId is { } nextId) AddOutbox(visit.Id, nextId);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(dto);
    }

    private async Task<(T? Value, bool Conflict)> FindReplayAsync<T>(string scope, string key, string requestHash, CancellationToken cancellationToken)
    {
        var keyHash = Hash(key);
        var existing = await db.IdempotencyRecords.AsNoTracking()
            .SingleOrDefaultAsync(record => record.Scope == scope && record.KeyHash == keyHash, cancellationToken);
        if (existing is null) return (default, false);
        if (existing.RequestHash != requestHash) return (default, true);
        return (existing.ResponseJson is null ? default : JsonSerializer.Deserialize<T>(existing.ResponseJson), false);
    }

    private void SaveCommand<T>(string scope, string key, string requestHash, Guid resultId, T response) =>
        db.IdempotencyRecords.Add(new IdempotencyRecord
        {
            Scope = scope,
            KeyHash = Hash(key),
            RequestHash = requestHash,
            ResultId = resultId,
            ResponseJson = JsonSerializer.Serialize(response),
            CreatedAtUtc = clock.GetUtcNow()
        });

    private void AddAudit(string action, string type, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = CurrentUserId(), Action = action, TargetType = type, TargetId = id,
        OccurredAtUtc = clock.GetUtcNow(), CorrelationId = HttpContext.TraceIdentifier
    });

    private void AddOutbox(Guid aggregateId, Guid departmentId) => db.OutboxMessages.Add(new OutboxMessage
    {
        Type = "QueueChanged", AggregateId = aggregateId, DepartmentId = departmentId, CreatedAtUtc = clock.GetUtcNow()
    });

    private Guid? CurrentUserId() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private static string? ParseIdempotencyKey(string? key) => Guid.TryParse(key, out var parsed) && parsed != Guid.Empty ? parsed.ToString("N") : null;
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static (DateTimeOffset? Value, bool IsInvalid) ParseClinicLocalTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return (null, false);
        if (!DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
        {
            return (null, true);
        }
        local = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        return (new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, ClinicTimeZone)), false);
    }

    private static VisitDto ToVisitDto(Visit visit) => new(
        visit.Id, visit.VisitCode, visit.CurrentStep?.DepartmentId, visit.CurrentStep?.State.ToString(),
        visit.CurrentStep?.AppointmentAtUtc, visit.IssuedAtUtc, visit.Completed);
}

public sealed record IssueVisitRequest(Guid InitialDepartmentId, string? AppointmentAtLocal);
public sealed record CompleteVisitRequest(Guid? NextDepartmentId, string? NextDepartmentAppointmentAtLocal);
public sealed record IssuedVisitDto(Guid Id, string VisitCode, Guid DepartmentId, DateTimeOffset? AppointmentAtUtc, DateTimeOffset IssuedAtUtc);
public sealed record VisitDto(Guid Id, string VisitCode, Guid? DepartmentId, string? Status, DateTimeOffset? AppointmentAtUtc, DateTimeOffset IssuedAtUtc, bool Completed);
public sealed record QueueVisitDto(Guid Id, string VisitCode, Guid DepartmentId, string Status, DateTimeOffset? AppointmentAtUtc, DateTimeOffset IssuedAtUtc, DateTimeOffset? CalledAtUtc, bool IsEligible = true);
public sealed record DepartmentQueueDto(string DepartmentName, QueueVisitDto[] Waiting, QueueVisitDto[] Called);
public sealed record CompleteVisitDto(Guid Id, string VisitCode, bool Completed, Guid? NextDepartmentId);
