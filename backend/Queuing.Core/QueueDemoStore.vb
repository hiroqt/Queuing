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

    Private NotInheritable Class QueueEntry
        Public Sub New(sequence As Long, ticket As DemoTicket)
            Me.Sequence = sequence
            Me.Ticket = ticket
        End Sub

        Public ReadOnly Property Sequence As Long
        Public ReadOnly Property Ticket As DemoTicket
    End Class
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
    Public ReadOnly Property Status As String
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
