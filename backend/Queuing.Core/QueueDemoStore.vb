Imports System.Globalization

Public NotInheritable Class QueueDemoStore
    Private ReadOnly _gate As New Object()
    Private ReadOnly _services As DemoService() = {
        New DemoService("consultation", "Consultation"),
        New DemoService("laboratory", "Laboratory"),
        New DemoService("follow-up", "Follow-up")
    }
    Private ReadOnly _tickets As New List(Of QueueEntry)()
    Private ReadOnly _idempotencyKeys As New Dictionary(Of Guid, QueueEntry)()
    Private ReadOnly _callRequests As New Dictionary(Of Guid, CallRequestEntry)()
    Private _nextSequence As Long

    Public Function GetServices() As IReadOnlyList(Of DemoService)
        Return Array.AsReadOnly(_services)
    End Function

    Public Function Issue(serviceId As String, idempotencyKey As Guid) As IssueResult
        SyncLock _gate
            Dim existing As QueueEntry = Nothing
            If _idempotencyKeys.TryGetValue(idempotencyKey, existing) Then
                If String.Equals(existing.Ticket.ServiceId, serviceId, StringComparison.Ordinal) Then
                    Return New IssueResult(IssueStatus.Replayed, existing.Ticket)
                End If

                Return New IssueResult(IssueStatus.IdempotencyConflict, Nothing)
            End If

            Dim selectedService = _services.FirstOrDefault(Function(service) String.Equals(service.Id, serviceId, StringComparison.Ordinal))
            If selectedService Is Nothing Then
                Return New IssueResult(IssueStatus.InvalidService, Nothing)
            End If

            _nextSequence += 1
            Dim ticket = New DemoTicket(Guid.NewGuid(), _nextSequence.ToString("D3", CultureInfo.InvariantCulture), selectedService.Id, selectedService.Name, DateTimeOffset.UtcNow)
            Dim entry = New QueueEntry(_nextSequence, ticket)
            _tickets.Add(entry)
            _idempotencyKeys.Add(idempotencyKey, entry)

            Return New IssueResult(IssueStatus.Created, ticket)
        End SyncLock
    End Function

    Public Function GetTicket(id As Guid) As DemoTicket
        SyncLock _gate
            Return _tickets.Select(Function(entry) entry.Ticket).FirstOrDefault(Function(ticket) ticket.Id = id)
        End SyncLock
    End Function

    Public Function GetDisplaySnapshot() As QueueDisplaySnapshot
        SyncLock _gate
            Dim waiting = _tickets.Where(Function(entry) entry.Ticket.Status = "Waiting").OrderBy(Function(entry) entry.Sequence).ToArray()
            Dim calling = _tickets.Where(Function(entry) entry.Ticket.Status = "Called").
                OrderByDescending(Function(entry) entry.Ticket.CalledAtUtc).
                Take(3).
                Select(Function(entry) New DisplayTicket(entry.Ticket.Number, entry.Ticket.ServiceName, entry.Ticket.Status)).
                ToArray()
            Return New QueueDisplaySnapshot(
                waiting.Take(3).Select(Function(entry) New DisplayTicket(entry.Ticket.Number, entry.Ticket.ServiceName, entry.Ticket.Status)).ToArray(),
                waiting.Length,
                calling)
        End SyncLock
    End Function

    Public Function GetActiveDisplayQueue() As IReadOnlyList(Of QueueItem)
        SyncLock _gate
            Return _tickets.Where(Function(entry) entry.Ticket.Status = "Called").
                OrderByDescending(Function(entry) entry.Ticket.CalledAtUtc).
                Select(Function(entry) New QueueItem(entry.Ticket.Id,
                    entry.Ticket.Number,
                    entry.Ticket.ServiceName,
                    entry.Ticket.CalledCounterName,
                    entry.Ticket.Status,
                    entry.Ticket.CalledAtUtc.Value)).
                ToList().AsReadOnly()
        End SyncLock
    End Function

    Public Function CallNext(serviceId As String, counterName As String, idempotencyKey As Guid) As CallResult
        SyncLock _gate
            Dim existingRequest As CallRequestEntry = Nothing
            If _callRequests.TryGetValue(idempotencyKey, existingRequest) Then
                If String.Equals(existingRequest.ServiceId, serviceId, StringComparison.Ordinal) AndAlso
                   String.Equals(existingRequest.CounterName, counterName, StringComparison.Ordinal) Then
                    Return New CallResult(CallStatus.Replayed, existingRequest.Item)
                End If
                Return New CallResult(CallStatus.IdempotencyConflict, Nothing)
            End If

            Dim selectedService = _services.FirstOrDefault(Function(service) String.Equals(service.Id, serviceId, StringComparison.Ordinal))
            If selectedService Is Nothing Then
                Return New CallResult(CallStatus.InvalidService, Nothing)
            End If

            Dim waitingEntry = _tickets.FirstOrDefault(Function(entry) entry.Ticket.Status = "Waiting" AndAlso
                String.Equals(entry.Ticket.ServiceId, selectedService.Id, StringComparison.Ordinal))
            If waitingEntry Is Nothing Then
                Return New CallResult(CallStatus.NoWaitingTicket, Nothing)
            End If

            Dim calledAt = DateTimeOffset.UtcNow
            Dim resolvedCounter = If(String.IsNullOrWhiteSpace(counterName), "Counter 01", counterName.Trim())
            waitingEntry.Ticket.Status = "Called"
            waitingEntry.Ticket.CalledCounterName = resolvedCounter
            waitingEntry.Ticket.CalledAtUtc = calledAt
            Dim item = New QueueItem(waitingEntry.Ticket.Id,
                waitingEntry.Ticket.Number,
                waitingEntry.Ticket.ServiceName,
                resolvedCounter,
                waitingEntry.Ticket.Status,
                calledAt)

            _callRequests.Add(idempotencyKey, New CallRequestEntry(serviceId, counterName, item))
            Return New CallResult(CallStatus.Called, item)
        End SyncLock
    End Function

    Private NotInheritable Class QueueEntry
        Public Sub New(sequence As Long, ticket As DemoTicket)
            Me.Sequence = sequence
            Me.Ticket = ticket
        End Sub

        Public ReadOnly Property Sequence As Long
        Public ReadOnly Property Ticket As DemoTicket
    End Class

    Private NotInheritable Class CallRequestEntry
        Public Sub New(serviceId As String, counterName As String, item As QueueItem)
            Me.ServiceId = serviceId
            Me.CounterName = counterName
            Me.Item = item
        End Sub

        Public ReadOnly Property ServiceId As String
        Public ReadOnly Property CounterName As String
        Public ReadOnly Property Item As QueueItem
    End Class
End Class

Public NotInheritable Class QueueItem
    Public Sub New(ticketId As Guid, ticketNumber As String, department As String, counterName As String, status As String, timestamp As DateTimeOffset)
        Me.TicketId = ticketId
        Me.TicketNumber = ticketNumber
        Me.Department = department
        Me.CounterName = counterName
        Me.Status = status
        Me.Timestamp = timestamp
    End Sub

    Public ReadOnly Property TicketId As Guid
    Public ReadOnly Property TicketNumber As String
    Public ReadOnly Property Department As String
    Public ReadOnly Property CounterName As String
    Public ReadOnly Property Status As String
    Public ReadOnly Property Timestamp As DateTimeOffset
End Class

Public NotInheritable Class DemoService
    Public Sub New(id As String, name As String)
        Me.Id = id
        Me.Name = name
    End Sub

    Public ReadOnly Property Id As String
    Public ReadOnly Property Name As String
End Class

Public NotInheritable Class DemoTicket
    Public Sub New(id As Guid, number As String, serviceId As String, serviceName As String, issuedAtUtc As DateTimeOffset)
        Me.Id = id
        Me.Number = number
        Me.ServiceId = serviceId
        Me.ServiceName = serviceName
        Me.Status = "Waiting"
        Me.IssuedAtUtc = issuedAtUtc
    End Sub

    Public ReadOnly Property Id As Guid
    Public ReadOnly Property Number As String
    Public ReadOnly Property ServiceId As String
    Public ReadOnly Property ServiceName As String
    Public Property Status As String
    Public ReadOnly Property IssuedAtUtc As DateTimeOffset
    Public Property CalledCounterName As String
    Public Property CalledAtUtc As DateTimeOffset?
End Class

Public NotInheritable Class QueueDisplaySnapshot
    Public Sub New(waiting As IReadOnlyList(Of DisplayTicket), totalWaiting As Integer, calling As IReadOnlyList(Of DisplayTicket))
        Me.Waiting = waiting
        Me.TotalWaiting = totalWaiting
        Me.Calling = calling
    End Sub

    Public ReadOnly Property Waiting As IReadOnlyList(Of DisplayTicket)
    Public ReadOnly Property TotalWaiting As Integer
    Public ReadOnly Property Calling As IReadOnlyList(Of DisplayTicket)
End Class

Public NotInheritable Class DisplayTicket
    Public Sub New(number As String, serviceName As String, status As String)
        Me.Number = number
        Me.ServiceName = serviceName
        Me.Status = status
    End Sub

    Public ReadOnly Property Number As String
    Public ReadOnly Property ServiceName As String
    Public ReadOnly Property Status As String
End Class

Public NotInheritable Class IssueResult
    Public Sub New(status As IssueStatus, ticket As DemoTicket)
        Me.Status = status
        Me.Ticket = ticket
    End Sub

    Public ReadOnly Property Status As IssueStatus
    Public ReadOnly Property Ticket As DemoTicket
End Class

Public NotInheritable Class CallResult
    Public Sub New(status As CallStatus, item As QueueItem)
        Me.Status = status
        Me.Item = item
    End Sub

    Public ReadOnly Property Status As CallStatus
    Public ReadOnly Property Item As QueueItem
End Class

Public Enum CallStatus
    Called
    Replayed
    InvalidService
    NoWaitingTicket
    IdempotencyConflict
End Enum

Public Enum IssueStatus
    Created
    Replayed
    InvalidService
    IdempotencyConflict
End Enum
