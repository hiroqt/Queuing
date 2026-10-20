using Queuing.Core;

namespace Queuing.Api.Models;

public sealed record QueueItemDto(
    string TicketNumber,
    string Department,
    string CounterName,
    string Status
)
{
    public static QueueItemDto FromCore(QueueItem item) =>
        new(item.TicketNumber, item.Department, item.CounterName, item.Status);
}
