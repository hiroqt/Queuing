using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Data;

namespace Queuing.Api.Auth;

public static class DepartmentScope
{
    public static async Task<bool> CanAccessAsync(ClaimsPrincipal user, Guid departmentId, QueueDbContext db, CancellationToken cancellationToken)
    {
        if (user.IsInRole(QueueRoles.Admin))
        {
            return await db.Departments.AnyAsync(department => department.Id == departmentId && department.Active, cancellationToken);
        }

        if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return false;
        }

        return await db.UserDepartments.AnyAsync(assignment => assignment.UserId == userId &&
            assignment.DepartmentId == departmentId && assignment.Department.Active, cancellationToken);
    }
}
