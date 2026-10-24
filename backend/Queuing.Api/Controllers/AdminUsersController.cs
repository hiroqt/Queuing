using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Auth;
using Queuing.Api.Data;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/admin/users")]
[Authorize(Policy = QueueRoles.Admin)]
public sealed class AdminUsersController(
    QueueDbContext db,
    UserManager<QueueUser> users,
    RoleManager<IdentityRole<Guid>> roles) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var accounts = await users.Users.AsNoTracking().OrderBy(user => user.UserName).ToArrayAsync(cancellationToken);
        var roleByUserId = new Dictionary<Guid, string>();
        foreach (var role in new[] { QueueRoles.Admin, QueueRoles.Reception, QueueRoles.Staff })
        {
            foreach (var member in await users.GetUsersInRoleAsync(role)) roleByUserId[member.Id] = role;
        }
        var assignments = await db.UserDepartments.AsNoTracking().ToArrayAsync(cancellationToken);
        var departmentIdsByUser = assignments.GroupBy(item => item.UserId)
            .ToDictionary(group => group.Key, group => group.Select(item => item.DepartmentId).ToArray());
        var serviceAssignments = await db.UserServices.AsNoTracking().ToArrayAsync(cancellationToken);
        var serviceIdsByUser = serviceAssignments.GroupBy(item => item.UserId)
            .ToDictionary(group => group.Key, group => group.Select(item => item.ServiceId).ToArray());
        return Ok(accounts.Select(user => new AdminUserDto(
            user.Id, user.UserName ?? "", user.DisplayName,
            roleByUserId.GetValueOrDefault(user.Id, ""),
            departmentIdsByUser.GetValueOrDefault(user.Id, []), user.Active,
            serviceIdsByUser.GetValueOrDefault(user.Id, []))));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || !ValidRole(request.Role) ||
            !await ValidAssignments(request.Role, request.ServiceIds, null, cancellationToken))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose a valid role and active Service assignments.");
        }

        var oneTimeCredential = CreateTemporaryPassword();
        var userName = request.UserName.Trim();
        var user = new QueueUser
        {
            UserName = userName,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? userName : request.DisplayName.Trim(),
            MustChangePassword = true,
            Active = true
        };
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var created = await users.CreateAsync(user, oneTimeCredential);
        if (!created.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "The user could not be created.", detail: string.Join(" ", created.Errors.Select(error => error.Description)));
        }

        var departmentIds = await GetDepartmentIdsAsync(request.ServiceIds, cancellationToken);
        try
        {
            if (!await roles.RoleExistsAsync(request.Role))
            {
                var roleResult = await roles.CreateAsync(new IdentityRole<Guid>(request.Role));
                if (!roleResult.Succeeded) throw new InvalidOperationException("Could not create the role.");
            }
            var roleAdded = await users.AddToRoleAsync(user, request.Role);
            if (!roleAdded.Succeeded) throw new InvalidOperationException("Could not assign the role.");
            AddAssignments(user.Id, departmentIds);
            AddServiceAssignments(user.Id, request.ServiceIds);
            AddAudit("user.created", "user", user.Id);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            throw;
        }

        return Created($"/api/v1/admin/users/{user.Id}", new AdminUserDto(
            user.Id, user.UserName!, user.DisplayName, request.Role, departmentIds, user.Active, request.ServiceIds, oneTimeCredential));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        var currentServiceIds = await db.UserServices.Where(item => item.UserId == id).Select(item => item.ServiceId).ToArrayAsync(cancellationToken);
        if (!ValidRole(request.Role) || !await ValidAssignments(request.Role, request.ServiceIds, id, cancellationToken))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose a valid role and active Service assignments.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var activeAdmins = await users.GetUsersInRoleAsync(QueueRoles.Admin);
        if (user.Active && (!request.Active || request.Role != QueueRoles.Admin) &&
            await users.IsInRoleAsync(user, QueueRoles.Admin) && activeAdmins.Count(candidate => candidate.Active) <= 1)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "The last active administrator cannot be deactivated.");
        }

        var currentRoles = await users.GetRolesAsync(user);
        var removed = await users.RemoveFromRolesAsync(user, currentRoles);
        if (!removed.Succeeded) return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not update user roles.");
        var added = await users.AddToRoleAsync(user, request.Role);
        if (!added.Succeeded) return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not update user roles.");

        var requestedDepartmentIds = request.Role != QueueRoles.Staff
            ? []
            : request.ServiceIds.Length == 0 && currentServiceIds.Length == 0
                ? await db.UserDepartments.Where(item => item.UserId == id).Select(item => item.DepartmentId).ToArrayAsync(cancellationToken)
                : await GetDepartmentIdsAsync(request.ServiceIds, cancellationToken);
        HashSet<Guid> retainedDepartmentIds = request.Role == QueueRoles.Staff && request.Active
            ? requestedDepartmentIds.ToHashSet()
            : [];
        var stationAssignments = await db.StationStaff.Where(item => item.UserId == id).ToListAsync(cancellationToken);
        db.StationStaff.RemoveRange(stationAssignments.Where(item => !retainedDepartmentIds.Contains(item.DepartmentId)));

        var currentAssignments = await db.UserDepartments.Where(item => item.UserId == id).ToListAsync(cancellationToken);
        var requestedDepartments = requestedDepartmentIds.ToHashSet();
        db.UserDepartments.RemoveRange(currentAssignments.Where(item => !requestedDepartments.Contains(item.DepartmentId)));
        AddAssignments(id, requestedDepartments.Except(currentAssignments.Select(item => item.DepartmentId)));
        var currentServiceAssignments = await db.UserServices.Where(item => item.UserId == id).ToListAsync(cancellationToken);
        var requestedServices = request.Role == QueueRoles.Staff ? request.ServiceIds.ToHashSet() : [];
        db.UserServices.RemoveRange(currentServiceAssignments.Where(item => !requestedServices.Contains(item.ServiceId)));
        AddServiceAssignments(id, requestedServices.Except(currentServiceAssignments.Select(item => item.ServiceId)));
        user.Active = request.Active;
        user.DisplayName = request.DisplayName?.Trim() ?? user.DisplayName;
        var stampUpdated = await users.UpdateSecurityStampAsync(user);
        if (!stampUpdated.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not revoke existing user sessions.");
        }
        AddAudit("user.updated", "user", user.Id);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(new AdminUserDto(user.Id, user.UserName!, user.DisplayName, request.Role, requestedDepartmentIds, user.Active,
            request.Role == QueueRoles.Staff ? request.ServiceIds : []));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var isAdmin = await users.IsInRoleAsync(user, QueueRoles.Admin);
        if (isAdmin && user.Active)
        {
            var activeAdmins = await users.GetUsersInRoleAsync(QueueRoles.Admin);
            if (activeAdmins.Count(candidate => candidate.Active) <= 1)
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "The last active administrator cannot be deleted.");
        }

        if (await db.Visits.AsNoTracking().AnyAsync(visit => visit.IssuedByUserId == id, cancellationToken))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict,
                title: "This account has visit history.", detail: "Deactivate it to keep those records.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.StationStaff.RemoveRange(db.StationStaff.Where(item => item.UserId == id));
        db.UserServices.RemoveRange(db.UserServices.Where(item => item.UserId == id));
        db.UserDepartments.RemoveRange(db.UserDepartments.Where(item => item.UserId == id));
        AddAudit("user.deleted", "user", user.Id);
        var result = await users.DeleteAsync(user);
        if (!result.Succeeded)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This user could not be deleted.", detail: string.Join(" ", result.Errors.Select(error => error.Description)));
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    private async Task<bool> ValidAssignments(string role, Guid[] serviceIds, Guid? existingUserId, CancellationToken cancellationToken)
    {
        var unique = serviceIds.Distinct().ToArray();
        if (unique.Length != serviceIds.Length ||
            (role != QueueRoles.Staff && unique.Length != 0)) return false;
        if (unique.Length == 0)
        {
            return role != QueueRoles.Staff || existingUserId is { } legacyUserId &&
                !await db.UserServices.AnyAsync(item => item.UserId == legacyUserId, cancellationToken);
        }
        var alreadyAssigned = existingUserId is { } userId
            ? await db.UserServices.AsNoTracking().Where(item => item.UserId == userId)
                .Select(item => item.ServiceId).ToArrayAsync(cancellationToken)
            : [];
        foreach (var serviceId in unique)
        {
            var active = await db.Services.AsNoTracking().AnyAsync(service => service.Id == serviceId && service.Active &&
                db.Departments.Any(department => department.Id == service.DepartmentId && department.Active), cancellationToken);
            if (!active && !alreadyAssigned.Contains(serviceId)) return false;
        }
        return true;
    }

    private async Task<Guid[]> GetDepartmentIdsAsync(Guid[] serviceIds, CancellationToken cancellationToken)
    {
        var departmentIds = new HashSet<Guid>();
        foreach (var serviceId in serviceIds)
        {
            var departmentId = await db.Services.AsNoTracking().Where(service => service.Id == serviceId)
                .Select(service => service.DepartmentId).SingleAsync(cancellationToken);
            departmentIds.Add(departmentId);
        }
        return departmentIds.ToArray();
    }

    private static bool ValidRole(string role) => role is QueueRoles.Admin or QueueRoles.Reception or QueueRoles.Staff;

    private void AddAssignments(Guid userId, IEnumerable<Guid> departmentIds) =>
        db.UserDepartments.AddRange(departmentIds.Select(departmentId => new UserDepartment { UserId = userId, DepartmentId = departmentId }));

    private void AddServiceAssignments(Guid userId, IEnumerable<Guid> serviceIds) =>
        db.UserServices.AddRange(serviceIds.Select(serviceId => new UserService { UserId = userId, ServiceId = serviceId }));

    private void AddAudit(string action, string type, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var actor) ? actor : null,
        Action = action,
        TargetType = type,
        TargetId = id,
        CorrelationId = HttpContext.TraceIdentifier
    });

    private static string CreateTemporaryPassword() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)).Replace('+', 'A').Replace('/', 'b').TrimEnd('=') + "!aA1";
}

public sealed record CreateUserRequest(
    [Required, StringLength(100, MinimumLength = 2)] string UserName,
    [StringLength(120, MinimumLength = 2)] string? DisplayName,
    [Required] string Role,
    [Required] Guid[] ServiceIds);

public sealed record UpdateUserRequest([Required] string Role, [Required] Guid[] ServiceIds, bool Active, string? DisplayName);
public sealed record AdminUserDto(Guid Id, string UserName, string DisplayName, string Role, Guid[] DepartmentIds, bool Active, Guid[] ServiceIds, string? OneTimeCredential = null);
