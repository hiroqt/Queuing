using Queuing.Core;
using Xunit;

namespace Queuing.Core.Tests;

public sealed class QueueDemoStoreTests
{
    private static readonly string[] ServiceIds = ["consultation", "laboratory", "follow-up"];

    [Fact]
    public void Issues_one_shared_sequence_across_services()
    {
        var store = new QueueDemoStore();

        var first = store.Issue(ServiceIds[0], Guid.NewGuid());
        var second = store.Issue(ServiceIds[1], Guid.NewGuid());
        var third = store.Issue(ServiceIds[2], Guid.NewGuid());

        Assert.Equal(IssueStatus.Created, first.Status);
        Assert.Equal("001", first.Ticket!.Number);
        Assert.Equal("002", second.Ticket!.Number);
        Assert.Equal("003", third.Ticket!.Number);
    }

    [Fact]
    public void Repeated_idempotency_key_returns_same_ticket_without_advancing_sequence()
    {
        var store = new QueueDemoStore();
        var key = Guid.NewGuid();

        var original = store.Issue(ServiceIds[0], key);
        var retry = store.Issue(ServiceIds[0], key);
        var next = store.Issue(ServiceIds[1], Guid.NewGuid());

        Assert.Equal(IssueStatus.Created, original.Status);
        Assert.Equal(IssueStatus.Replayed, retry.Status);
        Assert.Equal(original.Ticket!.Id, retry.Ticket!.Id);
        Assert.Equal("002", next.Ticket!.Number);
    }

    [Fact]
    public void Rejects_unknown_service_and_idempotency_key_payload_conflict()
    {
        var store = new QueueDemoStore();
        var key = Guid.NewGuid();

        var unknown = store.Issue("unknown", Guid.NewGuid());
        var original = store.Issue(ServiceIds[0], key);
        var conflict = store.Issue(ServiceIds[1], key);
        var next = store.Issue(ServiceIds[2], Guid.NewGuid());

        Assert.Equal(IssueStatus.InvalidService, unknown.Status);
        Assert.Equal(IssueStatus.Created, original.Status);
        Assert.Equal(IssueStatus.IdempotencyConflict, conflict.Status);
        Assert.Equal("002", next.Ticket!.Number);
    }

    [Fact]
    public void Display_returns_three_oldest_waiting_tickets_and_no_calls()
    {
        var store = new QueueDemoStore();
        for (var index = 0; index < 5; index++)
        {
            store.Issue(ServiceIds[index % ServiceIds.Length], Guid.NewGuid());
        }

        var snapshot = store.GetDisplaySnapshot();

        Assert.Equal(5, snapshot.TotalWaiting);
        Assert.Equal(new[] { "001", "002", "003" }, snapshot.Waiting.Select(ticket => ticket.Number));
        Assert.Equal(new[] { "Number", "ServiceName", "Status" }, typeof(DisplayTicket).GetProperties().Select(property => property.Name));
        Assert.Empty(snapshot.Calling);
    }

    [Fact]
    public void Concurrent_issues_receive_unique_numbers()
    {
        var store = new QueueDemoStore();
        var issued = new IssueResult[100];

        Parallel.For(0, issued.Length, index =>
        {
            issued[index] = store.Issue(ServiceIds[index % ServiceIds.Length], Guid.NewGuid());
        });

        Assert.All(issued, result => Assert.Equal(IssueStatus.Created, result.Status));
        Assert.Equal(issued.Length, issued.Select(result => result.Ticket!.Number).Distinct().Count());
        Assert.Equal(Enumerable.Range(1, issued.Length).Select(number => number.ToString("D3")), issued.Select(result => result.Ticket!.Number).Order());
        Assert.Equal(issued.Length, store.GetDisplaySnapshot().TotalWaiting);
    }

    [Fact]
    public void New_store_starts_a_fresh_volatile_sequence()
    {
        var firstProcess = new QueueDemoStore();
        firstProcess.Issue(ServiceIds[0], Guid.NewGuid());

        var restartedProcess = new QueueDemoStore();
        var next = restartedProcess.Issue(ServiceIds[1], Guid.NewGuid());

        Assert.Equal("001", next.Ticket!.Number);
        Assert.Equal(1, restartedProcess.GetDisplaySnapshot().TotalWaiting);
    }

    [Fact]
    public void GetActiveDisplayQueue_returns_active_calls_with_queue_item_properties()
    {
        var store = new QueueDemoStore();
        var items = store.GetActiveDisplayQueue();

        Assert.NotEmpty(items);
        var first = items[0];
        Assert.NotEqual(Guid.Empty, first.TicketId);
        Assert.False(string.IsNullOrWhiteSpace(first.TicketNumber));
        Assert.False(string.IsNullOrWhiteSpace(first.Department));
        Assert.False(string.IsNullOrWhiteSpace(first.CounterName));
        Assert.False(string.IsNullOrWhiteSpace(first.Status));
    }

    [Fact]
    public void CallNext_advances_waiting_ticket_to_called_status()
    {
        var store = new QueueDemoStore();
        var issueResult = store.Issue(ServiceIds[0], Guid.NewGuid());
        Assert.Equal("001", issueResult.Ticket!.Number);

        var calledItem = store.CallNext("Consultation", "Counter 02");
        Assert.Equal("001", calledItem.TicketNumber);
        Assert.Equal("Consultation", calledItem.Department);
        Assert.Equal("Counter 02", calledItem.CounterName);
        Assert.Equal("Called", calledItem.Status);

        var active = store.GetActiveDisplayQueue();
        Assert.Equal(calledItem.TicketNumber, active[0].TicketNumber);
    }

    [Fact]
    public void RecallTicket_prepends_recalled_entry()
    {
        var store = new QueueDemoStore();
        var recalled = store.RecallTicket("A-101", "Counter 03");

        Assert.Equal("A-101", recalled.TicketNumber);
        Assert.Equal("Counter 03", recalled.CounterName);
        Assert.Equal("Recalled", recalled.Status);

        var active = store.GetActiveDisplayQueue();
        Assert.Equal("A-101", active[0].TicketNumber);
        Assert.Equal("Recalled", active[0].Status);
    }
}

