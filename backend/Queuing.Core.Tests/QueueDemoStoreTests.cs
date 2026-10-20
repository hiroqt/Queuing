using Queuing.Core;
using Xunit;

namespace Queuing.Core.Tests;

public sealed class QueueDemoStoreTests
{
    [Theory]
    [InlineData(null, true)]
    [InlineData("2026-10-20T00:00:00+00:00", true)]
    [InlineData("2026-10-20T00:00:01+00:00", false)]
    public void Appointment_is_eligible_only_when_due(string? appointmentAt, bool expected)
    {
        var now = DateTimeOffset.Parse("2026-10-20T00:00:00+00:00");
        DateTimeOffset? appointment = appointmentAt is null ? null : DateTimeOffset.Parse(appointmentAt);

        Assert.Equal(expected, DepartmentQueuePolicy.IsAppointmentEligible(appointment, now));
    }

    [Theory]
    [InlineData(DepartmentStepState.Pending, false, false, false)]
    [InlineData(DepartmentStepState.Called, true, true, true)]
    [InlineData(DepartmentStepState.Completed, false, false, false)]
    public void Department_step_transitions_preserve_queue_rules(
        DepartmentStepState state,
        bool canReturnToPending,
        bool canComplete,
        bool canBeForwarded)
    {
        Assert.Equal(state == DepartmentStepState.Pending, DepartmentQueuePolicy.CanCall(state));
        Assert.Equal(canReturnToPending, DepartmentQueuePolicy.CanReturnToPending(state));
        Assert.Equal(canComplete, DepartmentQueuePolicy.CanComplete(state));
        Assert.Equal(canBeForwarded, DepartmentQueuePolicy.CanForward(state));
    }

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
    public void Fresh_store_has_no_fabricated_display_items()
    {
        var store = new QueueDemoStore();

        Assert.Empty(store.GetActiveDisplayQueue());
        Assert.Empty(store.GetDisplaySnapshot().Calling);
    }

    [Fact]
    public void CallNext_selects_oldest_waiting_ticket_for_the_selected_service()
    {
        var store = new QueueDemoStore();
        store.Issue(ServiceIds[0], Guid.NewGuid());
        store.Issue(ServiceIds[1], Guid.NewGuid());
        store.Issue(ServiceIds[1], Guid.NewGuid());

        var result = store.CallNext(ServiceIds[1], "Counter 01", Guid.NewGuid());

        Assert.Equal(CallStatus.Called, result.Status);
        Assert.Equal("002", result.Item!.TicketNumber);
        Assert.Equal("Laboratory", result.Item.Department);
        Assert.Equal("Counter 01", result.Item.CounterName);
        Assert.Equal("Called", result.Item.Status);
        Assert.Equal(new[] { "002" }, store.GetActiveDisplayQueue().Select(item => item.TicketNumber));
        Assert.Equal(new[] { "001", "003" }, store.GetDisplaySnapshot().Waiting.Select(ticket => ticket.Number));
    }

    [Fact]
    public void CallNext_does_not_fall_back_to_another_service_or_create_a_ticket()
    {
        var store = new QueueDemoStore();
        var issued = store.Issue(ServiceIds[1], Guid.NewGuid());

        var result = store.CallNext(ServiceIds[0], "Counter 01", Guid.NewGuid());

        Assert.Equal(CallStatus.NoWaitingTicket, result.Status);
        Assert.Equal("Waiting", store.GetTicket(issued.Ticket!.Id)!.Status);
        Assert.Empty(store.GetActiveDisplayQueue());

        var next = store.Issue(ServiceIds[0], Guid.NewGuid());
        Assert.Equal("002", next.Ticket!.Number);
    }

    [Fact]
    public void CallNext_rejects_unknown_services_without_changing_queue()
    {
        var store = new QueueDemoStore();
        store.Issue(ServiceIds[0], Guid.NewGuid());

        var result = store.CallNext("unknown", "Counter 01", Guid.NewGuid());

        Assert.Equal(CallStatus.InvalidService, result.Status);
        Assert.Equal(new[] { "001" }, store.GetDisplaySnapshot().Waiting.Select(ticket => ticket.Number));
        Assert.Empty(store.GetActiveDisplayQueue());
    }

    [Fact]
    public void CallNext_retries_with_same_key_return_same_ticket_without_calling_another()
    {
        var store = new QueueDemoStore();
        store.Issue(ServiceIds[0], Guid.NewGuid());
        store.Issue(ServiceIds[0], Guid.NewGuid());
        var key = Guid.NewGuid();

        var first = store.CallNext(ServiceIds[0], "Counter 01", key);
        var retry = store.CallNext(ServiceIds[0], "Counter 01", key);
        var next = store.CallNext(ServiceIds[0], "Counter 01", Guid.NewGuid());

        Assert.Equal(CallStatus.Called, first.Status);
        Assert.Equal(CallStatus.Replayed, retry.Status);
        Assert.Equal(first.Item!.TicketNumber, retry.Item!.TicketNumber);
        Assert.Equal("001", retry.Item.TicketNumber);
        Assert.Equal("002", next.Item!.TicketNumber);
    }

    [Fact]
    public void CallNext_rejects_reusing_key_for_different_request()
    {
        var store = new QueueDemoStore();
        store.Issue(ServiceIds[0], Guid.NewGuid());
        var key = Guid.NewGuid();
        store.CallNext(ServiceIds[0], "Counter 01", key);

        var conflict = store.CallNext(ServiceIds[0], "Counter 02", key);

        Assert.Equal(CallStatus.IdempotencyConflict, conflict.Status);
        Assert.Equal(new[] { "001" }, store.GetActiveDisplayQueue().Select(item => item.TicketNumber));
    }
}

