using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Queuing.Api.Data;

public sealed class QueueDatabaseHealthCheck(QueueDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default) =>
        await db.Database.CanConnectAsync(cancellationToken)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("The queue database is unavailable.");
}
