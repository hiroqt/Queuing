using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySql.Data.MySqlClient;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/admin/stations")]
[Authorize(Policy = QueueRoles.Admin)]
public sealed class AdminStationsController(
    QueueDbContext db,
    UserManager<QueueUser> users,
    TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var stations = await db.Stations.AsNoTracking()
            .OrderBy(station => station.DepartmentId).ThenBy(station => station.Name)
            .Select(station => new { station.Id, station.Name, station.DepartmentId, station.Active })
            .ToArrayAsync(cancellationToken);
        if (stations.Length == 0) return Ok(Array.Empty<AdminStationDto>());

        var serviceAssignments = await (from assignment in db.StationServices.AsNoTracking()
            join station in db.Stations.AsNoTracking()
                on new { assignment.DepartmentId, assignment.StationId }
                equals new { station.DepartmentId, StationId = station.Id }
            select new { assignment.StationId, assignment.ServiceId })
            .ToArrayAsync(cancellationToken);
        var staffAssignments = await (from assignment in db.StationStaff.AsNoTracking()
            join station in db.Stations.AsNoTracking()
                on new { assignment.DepartmentId, assignment.StationId }
                equals new { station.DepartmentId, StationId = station.Id }
            select new { assignment.StationId, assignment.UserId })
            .ToArrayAsync(cancellationToken);
        var servicesByStation = serviceAssignments.GroupBy(assignment => assignment.StationId)
            .ToDictionary(group => group.Key, group => group.Select(assignment => assignment.ServiceId).ToArray());
        var staffByStation = staffAssignments.GroupBy(assignment => assignment.StationId)
            .ToDictionary(group => group.Key, group => group.Select(assignment => assignment.UserId).ToArray());

        return Ok(stations.Select(station => new AdminStationDto(
            station.Id,
            station.Name,
            station.DepartmentId,
            station.Active,
            servicesByStation.GetValueOrDefault(station.Id, []),
            staffByStation.GetValueOrDefault(station.Id, []))).ToArray());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStationRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        var serviceIds = request.ServiceIds ?? [];
        var staffUserIds = request.StaffUserIds ?? [];
        if (request.DepartmentId == Guid.Empty || name.Length < 2)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose a department and enter a station name with at least two characters.");
        if (!await db.Departments.AnyAsync(department => department.Id == request.DepartmentId && department.Active, cancellationToken))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose an active department.");
        if (await db.Stations.AnyAsync(station => station.DepartmentId == request.DepartmentId && station.Name == name, cancellationToken))
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A station with that name already exists in this department.");
        if (!await ServicesBelongToDepartment(request.DepartmentId, serviceIds, cancellationToken))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose Services assigned to this station's department without duplicates.");
        if (!await StaffBelongToDepartment(request.DepartmentId, staffUserIds, cancellationToken))
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose active Staff assigned to this station's department without duplicates.");

        var station = new Station { Name = name, DepartmentId = request.DepartmentId };
        db.Stations.Add(station);
        db.StationServices.AddRange(serviceIds.Select(serviceId => new StationService
        {
            DepartmentId = station.DepartmentId,
            StationId = station.Id,
            ServiceId = serviceId
        }));
        db.StationStaff.AddRange(staffUserIds.Select(userId => new StationStaff
        {
            DepartmentId = station.DepartmentId,
            StationId = station.Id,
            UserId = userId
        }));
        AddAudit("station.created", station.Id);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is MySqlException { Number: 1062 })
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A matching station configuration already exists. Reload and try again.");
        }
        return Created($"/api/v1/admin/stations/{station.Id}",
            new AdminStationDto(station.Id, station.Name, station.DepartmentId, station.Active, serviceIds, staffUserIds));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStationRequest request, CancellationToken cancellationToken)
    {
        var station = await db.Stations.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (station is null) return NotFound();

        if (request.Name is { } submittedName)
        {
            var name = submittedName.Trim();
            if (name.Length < 2) return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Station name must contain at least two characters.");
            if (await db.Stations.AnyAsync(item => item.Id != id && item.DepartmentId == station.DepartmentId && item.Name == name, cancellationToken))
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "A station with that name already exists in this department.");
            station.Name = name;
        }
        if (request.Active.HasValue) station.Active = request.Active.Value;

        if (request.ServiceIds is { } serviceIds)
        {
            if (!await ServicesBelongToDepartment(station.DepartmentId, serviceIds, cancellationToken))
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose Services assigned to this station's department without duplicates.");
            var current = await db.StationServices.Where(item => item.StationId == id).ToListAsync(cancellationToken);
            ReplaceAssignments(
                current,
                serviceIds,
                assignment => assignment.ServiceId,
                serviceId => new StationService { DepartmentId = station.DepartmentId, StationId = id, ServiceId = serviceId },
                db.StationServices);
        }

        if (request.StaffUserIds is { } staffUserIds)
        {
            if (!await StaffBelongToDepartment(station.DepartmentId, staffUserIds, cancellationToken))
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose active Staff assigned to this station's department without duplicates.");
            var current = await db.StationStaff.Where(item => item.StationId == id).ToListAsync(cancellationToken);
            ReplaceAssignments(
                current,
                staffUserIds,
                assignment => assignment.UserId,
                userId => new StationStaff { DepartmentId = station.DepartmentId, StationId = id, UserId = userId },
                db.StationStaff);
        }

        AddAudit("station.updated", station.Id);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is MySqlException { Number: 1062 })
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A matching station configuration already exists. Reload and try again.");
        }
        var updatedServiceIds = await db.StationServices.AsNoTracking().Where(item => item.StationId == id)
            .Select(item => item.ServiceId).ToArrayAsync(cancellationToken);
        var updatedStaffIds = await db.StationStaff.AsNoTracking().Where(item => item.StationId == id)
            .Select(item => item.UserId).ToArrayAsync(cancellationToken);
        return Ok(new AdminStationDto(station.Id, station.Name, station.DepartmentId, station.Active, updatedServiceIds, updatedStaffIds));
    }

    private async Task<bool> ServicesBelongToDepartment(Guid departmentId, Guid[] serviceIds, CancellationToken cancellationToken)
    {
        if (serviceIds.Distinct().Count() != serviceIds.Length) return false;
        if (serviceIds.Length == 0) return true;
        return await db.Services.CountAsync(service => service.DepartmentId == departmentId && serviceIds.Contains(service.Id), cancellationToken)
            == serviceIds.Length;
    }

    private async Task<bool> StaffBelongToDepartment(Guid departmentId, Guid[] userIds, CancellationToken cancellationToken)
    {
        if (userIds.Distinct().Count() != userIds.Length) return false;
        if (userIds.Length == 0) return true;
        var staffIds = (await users.GetUsersInRoleAsync(QueueRoles.Staff))
            .Where(user => user.Active && userIds.Contains(user.Id))
            .Select(user => user.Id)
            .ToHashSet();
        var departmentStaffIds = await db.UserDepartments.AsNoTracking()
            .Where(assignment => assignment.DepartmentId == departmentId && assignment.User.Active)
            .Select(assignment => assignment.UserId)
            .ToArrayAsync(cancellationToken);
        var eligibleIds = staffIds.Intersect(departmentStaffIds).ToHashSet();
        return userIds.All(eligibleIds.Contains);
    }

    private static void ReplaceAssignments<TAssignment>(
        List<TAssignment> current,
        Guid[] desiredIds,
        Func<TAssignment, Guid> getId,
        Func<Guid, TAssignment> create,
        DbSet<TAssignment> dbSet) where TAssignment : class
    {
        var desired = desiredIds.ToHashSet();
        var currentIds = current.Select(getId).ToHashSet();
        dbSet.RemoveRange(current.Where(assignment => !desired.Contains(getId(assignment))));
        dbSet.AddRange(desired.Except(currentIds).Select(create));
    }

    private void AddAudit(string action, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actor) ? actor : null,
        Action = action,
        TargetType = "station",
        TargetId = id,
        CorrelationId = HttpContext.TraceIdentifier,
        OccurredAtUtc = clock.GetUtcNow()
    });
}

public sealed record CreateStationRequest(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [Required] Guid DepartmentId,
    Guid[]? ServiceIds,
    Guid[]? StaffUserIds);

public sealed record UpdateStationRequest(
    [StringLength(100, MinimumLength = 2)] string? Name,
    bool? Active,
    Guid[]? ServiceIds,
    Guid[]? StaffUserIds);

public sealed record AdminStationDto(
    Guid Id,
    string Name,
    Guid DepartmentId,
    bool Active,
    Guid[] ServiceIds,
    Guid[] StaffUserIds);
