using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySql.Data.MySqlClient;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/admin/services")]
[Authorize(Policy = QueueRoles.Admin)]
public sealed class AdminServicesController(QueueDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(await db.Services.AsNoTracking()
            .OrderBy(service => service.DepartmentId).ThenBy(service => service.Name)
            .Select(service => new AdminServiceDto(service.Id, service.Name, service.DepartmentId, service.Active))
            .ToArrayAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateServiceRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (request.DepartmentId == Guid.Empty || name.Length < 2)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose a department and enter a service name with at least two characters.");
        if (!await db.Departments.AnyAsync(department => department.Id == request.DepartmentId && department.Active, cancellationToken))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose an active department.");
        if (await db.Services.AnyAsync(service => service.DepartmentId == request.DepartmentId && service.Name == name, cancellationToken))
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A service with that name already exists in this department.");

        var service = new ClinicService { Name = name, DepartmentId = request.DepartmentId };
        db.Services.Add(service);
        AddAudit("service.created", service.Id);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is MySqlException { Number: 1062 })
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A matching service configuration already exists. Reload and try again.");
        }
        return Created($"/api/v1/admin/services/{service.Id}",
            new AdminServiceDto(service.Id, service.Name, service.DepartmentId, service.Active));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateServiceRequest request, CancellationToken cancellationToken)
    {
        var service = await db.Services.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (service is null) return NotFound();

        if (request.Name is { } submittedName)
        {
            var name = submittedName.Trim();
            if (name.Length < 2) return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Service name must contain at least two characters.");
            if (await db.Services.AnyAsync(item => item.Id != id && item.DepartmentId == service.DepartmentId && item.Name == name, cancellationToken))
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "A service with that name already exists in this department.");
            service.Name = name;
        }
        if (request.Active.HasValue) service.Active = request.Active.Value;

        AddAudit("service.updated", service.Id);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is MySqlException { Number: 1062 })
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A matching service configuration already exists. Reload and try again.");
        }
        return Ok(new AdminServiceDto(service.Id, service.Name, service.DepartmentId, service.Active));
    }

    private void AddAudit(string action, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actor) ? actor : null,
        Action = action,
        TargetType = "service",
        TargetId = id,
        CorrelationId = HttpContext.TraceIdentifier,
        OccurredAtUtc = clock.GetUtcNow()
    });
}

public sealed record CreateServiceRequest(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [Required] Guid DepartmentId);

public sealed record UpdateServiceRequest([StringLength(100, MinimumLength = 2)] string? Name, bool? Active);
public sealed record AdminServiceDto(Guid Id, string Name, Guid DepartmentId, bool Active);
