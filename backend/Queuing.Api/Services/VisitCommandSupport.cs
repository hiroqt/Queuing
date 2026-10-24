using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Data;

namespace Queuing.Api.Services;

internal static class VisitCommandSupport
{
    private static readonly TimeZoneInfo ClinicTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

    public static async Task<(T? Value, bool Conflict)> FindReplayAsync<T>(
        QueueDbContext db, string scope, string key, string requestHash, CancellationToken cancellationToken)
    {
        var existing = await db.IdempotencyRecords.AsNoTracking()
            .SingleOrDefaultAsync(record => record.Scope == scope && record.KeyHash == Hash(key), cancellationToken);
        if (existing is null) return (default, false);
        if (existing.RequestHash != requestHash) return (default, true);
        return (existing.ResponseJson is null ? default : JsonSerializer.Deserialize<T>(existing.ResponseJson), false);
    }

    public static void SaveCommand<T>(QueueDbContext db, TimeProvider clock, string scope, string key, string requestHash, Guid resultId, T response) =>
        db.IdempotencyRecords.Add(new IdempotencyRecord
        {
            Scope = scope,
            KeyHash = Hash(key),
            RequestHash = requestHash,
            ResultId = resultId,
            ResponseJson = JsonSerializer.Serialize(response),
            CreatedAtUtc = clock.GetUtcNow()
        });

    public static void AddAudit(QueueDbContext db, TimeProvider clock, Guid? actorUserId, string correlationId, string action, string type, Guid id, Guid? actorKioskDeviceId = null) =>
        db.AuditRecords.Add(new AuditRecord
        {
            ActorUserId = actorUserId,
            ActorKioskDeviceId = actorKioskDeviceId,
            Action = action,
            TargetType = type,
            TargetId = id,
            OccurredAtUtc = clock.GetUtcNow(),
            CorrelationId = correlationId
        });

    public static void AddOutbox(QueueDbContext db, TimeProvider clock, Guid aggregateId, Guid departmentId) =>
        db.OutboxMessages.Add(new OutboxMessage
        {
            Type = "QueueChanged",
            AggregateId = aggregateId,
            DepartmentId = departmentId,
            CreatedAtUtc = clock.GetUtcNow()
        });

    public static Guid? CurrentUserId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static string? ParseIdempotencyKey(string? key) =>
        Guid.TryParse(key, out var parsed) && parsed != Guid.Empty ? parsed.ToString("N") : null;

    public static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static async Task<int> NextDepartmentTicketNumberAsync(
        QueueDbContext db, Guid departmentId, DateOnly clinicDate, CancellationToken cancellationToken)
    {
        var dateValue = clinicDate.ToDateTime(TimeOnly.MinValue);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO `DepartmentSequences` (`DepartmentId`, `ClinicDate`, `LastSequence`) VALUES ({departmentId}, {dateValue}, 1) ON DUPLICATE KEY UPDATE `LastSequence` = `LastSequence` + 1",
            cancellationToken);
        var sequence = await db.DepartmentSequences.FromSqlInterpolated(
                $"SELECT * FROM `DepartmentSequences` WHERE `DepartmentId` = {departmentId} AND `ClinicDate` = {dateValue} FOR UPDATE")
            .SingleAsync(cancellationToken);
        return sequence.LastSequence;
    }

    public static DateOnly ClinicDateAt(DateTimeOffset instant) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, ClinicTimeZone).DateTime);

    public static (DateTimeOffset? Value, bool IsInvalid) ParseClinicLocalTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return (null, false);
        if (!DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
            return (null, true);
        local = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        return (new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, ClinicTimeZone)), false);
    }
}
