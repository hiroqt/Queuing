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
    Private ReadOnly _activeCalls As New List(Of QueueItem)()
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
            Return New QueueDisplaySnapshot(
                waiting.Take(3).Select(Function(entry) New DisplayTicket(entry.Ticket.Number, entry.Ticket.ServiceName, entry.Ticket.Status)).ToArray(),
                waiting.Length,
                Array.Empty(Of DisplayTicket)())
        End SyncLock
    End Function

    Public Function GetActiveDisplayQueue() As IReadOnlyList(Of QueueItem)
        SyncLock _gate
            EnsureDemoDisplayItems()
            Return _activeCalls.OrderByDescending(Function(item) item.Timestamp).ToList().AsReadOnly()
        End SyncLock
    End Function

    Public Function CallNext(departmentOrServiceId As String, counterName As String) As QueueItem
        SyncLock _gate
            EnsureDemoDisplayItems()

            Dim normalizedDept = If(String.IsNullOrWhiteSpace(departmentOrServiceId), "Consultation", departmentOrServiceId.Trim())
            Dim resolvedCounter = If(String.IsNullOrWhiteSpace(counterName), "Counter 01", counterName.Trim())

            Dim waitingEntry = _tickets.FirstOrDefault(Function(entry) entry.Ticket.Status = "Waiting" AndAlso
                (String.Equals(entry.Ticket.ServiceId, normalizedDept, StringComparison.OrdinalIgnoreCase) OrElse
                 String.Equals(entry.Ticket.ServiceName, normalizedDept, StringComparison.OrdinalIgnoreCase)))

            If waitingEntry Is Nothing Then
                waitingEntry = _tickets.FirstOrDefault(Function(entry) entry.Ticket.Status = "Waiting")
            End If

            Dim ticketId As Guid
            Dim ticketNumber As String
            Dim deptName As String

            If waitingEntry IsNot Nothing Then
                ticketId = waitingEntry.Ticket.Id
                ticketNumber = waitingEntry.Ticket.Number
                deptName = waitingEntry.Ticket.ServiceName
                waitingEntry.Ticket.Status = "Called"
            Else
                _nextSequence += 1
                Dim prefix = GetDepartmentPrefix(normalizedDept)
                ticketNumber = $"{prefix}-{_nextSequence:D3}"
                ticketId = Guid.NewGuid()
                deptName = NormalizeDepartmentName(normalizedDept)
            End If

            Dim item = New QueueItem(ticketId, ticketNumber, deptName, resolvedCounter, "Called", DateTimeOffset.UtcNow)
            _activeCalls.Insert(0, item)
            If _activeCalls.Count > 30 Then
                _activeCalls.RemoveAt(_activeCalls.Count - 1)
            End If

            Return item
        End SyncLock
    End Function

    Public Function RecallTicket(ticketNumber As String, counterName As String) As QueueItem
        SyncLock _gate
            EnsureDemoDisplayItems()

            Dim target = _activeCalls.FirstOrDefault(Function(i) String.Equals(i.TicketNumber, ticketNumber, StringComparison.OrdinalIgnoreCase))
            Dim ticketId = If(target IsNot Nothing, target.TicketId, Guid.NewGuid())
            Dim deptName = If(target IsNot Nothing, target.Department, "General")
            Dim resolvedCounter = If(Not String.IsNullOrWhiteSpace(counterName), counterName.Trim(), If(target IsNot Nothing, target.CounterName, "Counter 01"))
            Dim resolvedNumber = If(Not String.IsNullOrWhiteSpace(ticketNumber), ticketNumber.Trim(), "A-101")

            Dim item = New QueueItem(ticketId, resolvedNumber, deptName, resolvedCounter, "Recalled", DateTimeOffset.UtcNow)
            _activeCalls.Insert(0, item)
            If _activeCalls.Count > 30 Then
                _activeCalls.RemoveAt(_activeCalls.Count - 1)
            End If

            Return item
        End SyncLock
    End Function

    Private Sub EnsureDemoDisplayItems()
        If _activeCalls.Count > 0 Then Return

        Dim now = DateTimeOffset.UtcNow
        _activeCalls.Add(New QueueItem(Guid.NewGuid(), "A-101", "Admissions", "Counter 01", "Called", now.AddSeconds(-25)))
        _activeCalls.Add(New QueueItem(Guid.NewGuid(), "B-042", "Billing", "Counter 03", "Called", now.AddMinutes(-2)))
        _activeCalls.Add(New QueueItem(Guid.NewGuid(), "C-104", "Consultation", "Window 2", "Called", now.AddMinutes(-4)))
        _activeCalls.Add(New QueueItem(Guid.NewGuid(), "L-018", "Laboratory", "Station 3", "Called", now.AddMinutes(-7)))
        _activeCalls.Add(New QueueItem(Guid.NewGuid(), "P-009", "Pharmacy", "Window 4", "Called", now.AddMinutes(-11)))
        _activeCalls.Add(New QueueItem(Guid.NewGuid(), "C-103", "Consultation", "Window 1", "Completed", now.AddMinutes(-15)))
    End Sub

    Private Shared Function GetDepartmentPrefix(dept As String) As String
        If String.IsNullOrWhiteSpace(dept) Then Return "A"
        Select Case dept.Trim().ToLowerInvariant()
            Case "admissions", "adm"
                Return "A"
            Case "billing", "bill", "cashier"
                Return "B"
            Case "consultation", "consult", "doctor"
                Return "C"
            Case "laboratory", "lab"
                Return "L"
            Case "pharmacy", "pharm"
                Return "P"
            Case Else
                Return dept.Trim().Substring(0, 1).ToUpperInvariant()
        End Select
    End Function

    Private Shared Function NormalizeDepartmentName(dept As String) As String
        If String.IsNullOrWhiteSpace(dept) Then Return "Consultation"
        Select Case dept.Trim().ToLowerInvariant()
            Case "admissions", "adm"
                Return "Admissions"
            Case "billing", "bill", "cashier"
                Return "Billing"
            Case "consultation", "consult"
                Return "Consultation"
            Case "laboratory", "lab"
                Return "Laboratory"
            Case "pharmacy", "pharm"
                Return "Pharmacy"
            Case Else
                Return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(dept.Trim())
        End Select
    End Function

    Private NotInheritable Class QueueEntry
        Public Sub New(sequence As Long, ticket As DemoTicket)
            Me.Sequence = sequence
            Me.Ticket = ticket
        End Sub

        Public ReadOnly Property Sequence As Long
        Public ReadOnly Property Ticket As DemoTicket
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

Public Enum IssueStatus
    Created
    Replayed
    InvalidService
    IdempotencyConflict
End Enum
