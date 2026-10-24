using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class DepartmentsController(QueueDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet("departments")]
    [Authorize(Roles = "Admin,Reception,Staff")]
    public async Task<IActionResult> ListActive(CancellationToken cancellationToken)
    {
        var query = db.Departments.AsNoTracking().Where(department => department.Active);
        if (User.IsInRole(QueueRoles.Staff))
        {
            var userId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : Guid.Empty;
            var departmentIds = db.UserDepartments.AsNoTracking().Where(assignment => assignment.UserId == userId)
                .Select(assignment => assignment.DepartmentId);
            query = query.Where(department => departmentIds.Contains(department.Id));
        }
        return Ok(await query.OrderBy(department => department.Name)
            .Select(department => new DepartmentDto(department.Id, department.Name, department.Active))
            .ToArrayAsync(cancellationToken));
    }

    [HttpGet("admin/departments")]
    [Authorize(Policy = QueueRoles.Admin)]
    public async Task<IActionResult> AdminList(CancellationToken cancellationToken) =>
        Ok(await db.Departments.AsNoTracking().OrderBy(department => department.Name)
            .Select(department => new DepartmentDto(department.Id, department.Name, department.Active))
            .ToArrayAsync(cancellationToken));

    [HttpPost("admin/departments")]
    [Authorize(Policy = QueueRoles.Admin)]
    public async Task<IActionResult> Create([FromBody] CreateDepartmentRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (name.Length < 2) return Problem(statusCode: 400, title: "Department name must contain at least two characters.");
        if (await db.Departments.AnyAsync(department => department.Name == name, cancellationToken))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A department with that name already exists.");
        }

        var department = new Department { Name = name };
        db.Departments.Add(department);
        AddDepartmentChangeNotification(department.Id);
        AddAudit("department.created", department.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/departments/{department.Id}", new DepartmentDto(department.Id, department.Name, department.Active));
    }

    [HttpPatch("admin/departments/{id:guid}")]
    [Authorize(Policy = QueueRoles.Admin)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDepartmentRequest request, CancellationToken cancellationToken)
    {
        var department = await db.Departments.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (department is null)
        {
            return NotFound();
        }

        if (request.Name is { } submittedName)
        {
            var name = submittedName.Trim();
            if (name.Length < 2) return Problem(statusCode: 400, title: "Department name must contain at least two characters.");
            if (await db.Departments.AnyAsync(item => item.Id != id && item.Name == name, cancellationToken))
            {
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "A department with that name already exists.");
            }
            department.Name = name;
        }

        if (request.Active is false)
        {
            var hasActiveSteps = await db.Visits.AnyAsync(visit => visit.CurrentStepId != null &&
                db.DepartmentSteps.Any(step => step.Id == visit.CurrentStepId && step.DepartmentId == id), cancellationToken);
            if (hasActiveSteps)
            {
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "Move or finish the active queue before deactivating this department.");
            }
        }

        var wasActive = department.Active;
        if (request.Active.HasValue)
        {
            department.Active = request.Active.Value;
        }
        if (wasActive != department.Active || request.Name is not null) AddDepartmentChangeNotification(department.Id);
        AddAudit("department.updated", department.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new DepartmentDto(department.Id, department.Name, department.Active));
    }

    private void AddAudit(string action, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actor) ? actor : null,
        Action = action,
        TargetType = "department",
        TargetId = id,
        CorrelationId = HttpContext.TraceIdentifier,
        OccurredAtUtc = clock.GetUtcNow()
    });

    private void AddDepartmentChangeNotification(Guid departmentId) => db.OutboxMessages.Add(new OutboxMessage
    {
        Type = "DepartmentChanged",
        AggregateId = departmentId,
        DepartmentId = departmentId,
        CreatedAtUtc = clock.GetUtcNow()
    });
}

public sealed record DepartmentDto(Guid Id, string Name, bool Active);
public sealed record CreateDepartmentRequest([Required, StringLength(100, MinimumLength = 2)] string Name);
public sealed record UpdateDepartmentRequest([StringLength(100, MinimumLength = 2)] string? Name, bool? Active);
