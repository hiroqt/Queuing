using Queuing.Core;

namespace Queuing.Api.Models;

public sealed record QueueItemDto(
    Guid TicketId,
    string TicketNumber,
    string Department,
    string CounterName,
    string Status,
    DateTimeOffset Timestamp
)
{
    public static QueueItemDto FromCore(QueueItem item) =>
        new(item.TicketId, item.TicketNumber, item.Department, item.CounterName, item.Status, item.Timestamp);
}

public sealed record CallTicketRequest(string? Department, string? CounterName);

public sealed record RecallTicketRequest(string TicketNumber, string? CounterName);
