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
        return Ok(accounts.Select(user => new AdminUserDto(
            user.Id, user.UserName ?? "", user.DisplayName,
            roleByUserId.GetValueOrDefault(user.Id, ""),
            departmentIdsByUser.GetValueOrDefault(user.Id, []), user.Active)));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || !ValidRole(request.Role) ||
            !await ValidAssignments(request.Role, request.DepartmentIds, cancellationToken))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose a valid role and active department assignments.");
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

        try
        {
            if (!await roles.RoleExistsAsync(request.Role))
            {
                var roleResult = await roles.CreateAsync(new IdentityRole<Guid>(request.Role));
                if (!roleResult.Succeeded) throw new InvalidOperationException("Could not create the role.");
            }
            var roleAdded = await users.AddToRoleAsync(user, request.Role);
            if (!roleAdded.Succeeded) throw new InvalidOperationException("Could not assign the role.");
            AddAssignments(user.Id, request.DepartmentIds);
            AddAudit("user.created", "user", user.Id);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            throw;
        }

        return Created($"/api/v1/admin/users/{user.Id}", new AdminUserDto(
            user.Id, user.UserName!, user.DisplayName, request.Role, request.DepartmentIds, user.Active, oneTimeCredential));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        if (!ValidRole(request.Role) || !await ValidAssignments(request.Role, request.DepartmentIds, cancellationToken))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Choose a valid role and active department assignments.");
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

        HashSet<Guid> retainedDepartmentIds = request.Role == QueueRoles.Staff && request.Active
            ? request.DepartmentIds.ToHashSet()
            : [];
        var stationAssignments = await db.StationStaff.Where(item => item.UserId == id).ToListAsync(cancellationToken);
        db.StationStaff.RemoveRange(stationAssignments.Where(item => !retainedDepartmentIds.Contains(item.DepartmentId)));

        var currentAssignments = await db.UserDepartments.Where(item => item.UserId == id).ToListAsync(cancellationToken);
        var requestedDepartmentIds = request.DepartmentIds.ToHashSet();
        db.UserDepartments.RemoveRange(currentAssignments.Where(item => !requestedDepartmentIds.Contains(item.DepartmentId)));
        AddAssignments(id, requestedDepartmentIds.Except(currentAssignments.Select(item => item.DepartmentId)));
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
        return Ok(new AdminUserDto(user.Id, user.UserName!, user.DisplayName, request.Role, request.DepartmentIds, user.Active));
    }

    private async Task<bool> ValidAssignments(string role, Guid[] departmentIds, CancellationToken cancellationToken)
    {
        var unique = departmentIds.Distinct().ToArray();
        if (unique.Length != departmentIds.Length ||
            (role == QueueRoles.Staff && unique.Length == 0) ||
            (role != QueueRoles.Staff && unique.Length != 0)) return false;
        if (unique.Length == 0) return true;
        var activeDepartmentIds = await db.Departments.AsNoTracking()
            .Where(department => department.Active)
            .Select(department => department.Id)
            .ToArrayAsync(cancellationToken);
        return unique.All(activeDepartmentIds.Contains);
    }

    private static bool ValidRole(string role) => role is QueueRoles.Admin or QueueRoles.Reception or QueueRoles.Staff;

    private void AddAssignments(Guid userId, IEnumerable<Guid> departmentIds) =>
        db.UserDepartments.AddRange(departmentIds.Select(departmentId => new UserDepartment { UserId = userId, DepartmentId = departmentId }));

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
    [Required] Guid[] DepartmentIds);

public sealed record UpdateUserRequest([Required] string Role, [Required] Guid[] DepartmentIds, bool Active, string? DisplayName);
public sealed record AdminUserDto(Guid Id, string UserName, string DisplayName, string Role, Guid[] DepartmentIds, bool Active, string? OneTimeCredential = null);
