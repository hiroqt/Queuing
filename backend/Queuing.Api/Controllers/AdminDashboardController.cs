using System.Linq.Expressions;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/admin/dashboard")]
[Authorize(Policy = QueueRoles.Admin)]
public sealed class AdminDashboardController(QueueDbContext db, TimeProvider clock, IMemoryCache cache) : ControllerBase
{
    public const string ConfigurationCacheKey = "admin-dashboard-configuration";
    private static readonly TimeSpan ConfigurationCacheDuration = TimeSpan.FromMinutes(1);

    [HttpGet]
    public async Task<IActionResult> Summary(
        [FromQuery] bool refreshConfiguration,
        [FromQuery] bool includeConfiguration = true,
        CancellationToken cancellationToken = default)
    {
        AdminDashboardConfiguration? configuration = null;
        if (includeConfiguration)
        {
            if (refreshConfiguration || !cache.TryGetValue<AdminDashboardConfiguration>(ConfigurationCacheKey, out configuration) || configuration is null)
            {
                configuration = await LoadConfigurationAsync(cancellationToken);
                cache.Set(ConfigurationCacheKey, configuration, ConfigurationCacheDuration);
            }
        }

        var displays = await Counts(db.DisplayDevices.AsNoTracking(), item => item.Active, cancellationToken);
        var departmentNames = await db.Departments.AsNoTracking()
            .OrderBy(department => department.Name)
            .Select(department => new AdminDashboardDepartmentName(department.Id, department.Name))
            .ToArrayAsync(cancellationToken);
        var queueCounts = await db.DepartmentSteps.AsNoTracking()
            .Where(step => step.Visit.CurrentStepId == step.Id &&
                (step.State == DepartmentStepState.Pending || step.State == DepartmentStepState.Called))
            .GroupBy(step => step.DepartmentId)
            .Select(group => new
            {
                DepartmentId = group.Key,
                Waiting = group.Count(step => step.State == DepartmentStepState.Pending),
                Called = group.Count(step => step.State == DepartmentStepState.Called)
            })
            .ToDictionaryAsync(item => item.DepartmentId, cancellationToken);
        var byDepartment = departmentNames.Select(department => new AdminDashboardDepartmentQueue(
            department.Id,
            department.Name,
            queueCounts.GetValueOrDefault(department.Id)?.Waiting ?? 0,
            queueCounts.GetValueOrDefault(department.Id)?.Called ?? 0)).ToArray();

        return Ok(new AdminDashboardSummary(
            clock.GetUtcNow(), configuration?.ConfigurationUpdatedAtUtc,
            configuration?.Departments, configuration?.Services, configuration?.Stations, configuration?.Users, displays, configuration?.Kiosks,
            configuration?.SetupChecks,
            new AdminDashboardQueue(byDepartment.Sum(item => item.WaitingCount), byDepartment.Sum(item => item.CalledCount), byDepartment)));
    }

    private async Task<AdminDashboardConfiguration> LoadConfigurationAsync(CancellationToken cancellationToken)
    {
        var departments = await Counts(db.Departments.AsNoTracking(), item => item.Active, cancellationToken);
        var services = await Counts(db.Services.AsNoTracking(), item => item.Active, cancellationToken);
        var stations = await Counts(db.Stations.AsNoTracking(), item => item.Active, cancellationToken);
        var users = await Counts(db.Users.AsNoTracking(), item => item.Active, cancellationToken);
        var kiosks = await Counts(db.KioskDevices.AsNoTracking(), item => item.Active, cancellationToken);
        var departmentsWithoutServices = await db.Departments.AsNoTracking()
            .CountAsync(department => department.Active && !db.Services.Any(service => service.DepartmentId == department.Id && service.Active), cancellationToken);
        var stationsWithoutStaff = await db.Stations.AsNoTracking()
            .CountAsync(station => station.Active && !db.StationStaff.Any(assignment => assignment.StationId == station.Id && assignment.UserDepartment.User.Active), cancellationToken);
        return new AdminDashboardConfiguration(
            clock.GetUtcNow(), departments, services, stations, users, kiosks,
            new AdminDashboardSetupChecks(departmentsWithoutServices, stationsWithoutStaff));
    }

    private static async Task<AdminDashboardSectionCounts> Counts<TEntity>(
        IQueryable<TEntity> source,
        Expression<Func<TEntity, bool>> isActive,
        CancellationToken cancellationToken)
    {
        var grouped = await source.GroupBy(isActive)
            .Select(group => new { Active = group.Key, Count = group.Count() })
            .ToArrayAsync(cancellationToken);
        var active = grouped.SingleOrDefault(item => item.Active)?.Count ?? 0;
        var total = grouped.Sum(item => item.Count);
        return new AdminDashboardSectionCounts(total, active, total - active);
    }
}

public sealed record AdminDashboardSummary(
    DateTimeOffset UpdatedAtUtc,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTimeOffset? ConfigurationUpdatedAtUtc,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AdminDashboardSectionCounts? Departments,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AdminDashboardSectionCounts? Services,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AdminDashboardSectionCounts? Stations,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AdminDashboardSectionCounts? Users,
    AdminDashboardSectionCounts Displays,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AdminDashboardSectionCounts? Kiosks,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AdminDashboardSetupChecks? SetupChecks,
    AdminDashboardQueue Queue);

public sealed record AdminDashboardConfiguration(
    DateTimeOffset ConfigurationUpdatedAtUtc,
    AdminDashboardSectionCounts Departments,
    AdminDashboardSectionCounts Services,
    AdminDashboardSectionCounts Stations,
    AdminDashboardSectionCounts Users,
    AdminDashboardSectionCounts Kiosks,
    AdminDashboardSetupChecks SetupChecks);

public sealed record AdminDashboardDepartmentName(Guid Id, string Name);
public sealed record AdminDashboardSectionCounts(int Total, int Active, int Inactive);
public sealed record AdminDashboardSetupChecks(int DepartmentsWithoutActiveServices, int StationsWithoutActiveStaff);
public sealed record AdminDashboardQueue(int WaitingCount, int CalledCount, AdminDashboardDepartmentQueue[] Departments);
public sealed record AdminDashboardDepartmentQueue(Guid DepartmentId, string DepartmentName, int WaitingCount, int CalledCount);
