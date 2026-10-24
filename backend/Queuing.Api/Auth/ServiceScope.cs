using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Data;

namespace Queuing.Api.Auth;

public static class ServiceScope
{
    public static async Task<bool> CanAccessDepartmentAsync(ClaimsPrincipal user, Guid departmentId, QueueDbContext db, CancellationToken cancellationToken)
    {
        if (user.IsInRole(QueueRoles.Admin))
        {
            return await db.Departments.AnyAsync(department => department.Id == departmentId && department.Active, cancellationToken);
        }

        if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return false;
        return await db.UserDepartments.AnyAsync(assignment => assignment.UserId == userId &&
            assignment.DepartmentId == departmentId && assignment.Department.Active, cancellationToken);
    }

    public static async Task<bool> CanAccessStepAsync(
        ClaimsPrincipal user,
        Guid departmentId,
        Guid? serviceId,
        QueueDbContext db,
        CancellationToken cancellationToken)
    {
        if (!await db.Departments.AnyAsync(department => department.Id == departmentId && department.Active, cancellationToken)) return false;
        if (user.IsInRole(QueueRoles.Admin)) return true;
        if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return false;

        return serviceId is { } id
            ? await db.UserServices.AnyAsync(assignment => assignment.UserId == userId && assignment.ServiceId == id, cancellationToken)
            : await db.UserDepartments.AnyAsync(assignment => assignment.UserId == userId && assignment.DepartmentId == departmentId, cancellationToken);
    }
}
