Public Enum DepartmentStepState
    Pending = 0
    Called = 1
    Completed = 2
End Enum

Public NotInheritable Class DepartmentQueuePolicy
    Private Sub New()
    End Sub

    Public Shared Function IsAppointmentEligible(appointmentAtUtc As DateTimeOffset?, nowUtc As DateTimeOffset) As Boolean
        Return Not appointmentAtUtc.HasValue OrElse appointmentAtUtc.Value <= nowUtc
    End Function

    Public Shared Function CanCall(state As DepartmentStepState) As Boolean
        Return state = DepartmentStepState.Pending
    End Function

    Public Shared Function CanReturnToPending(state As DepartmentStepState) As Boolean
        Return state = DepartmentStepState.Called
    End Function

    Public Shared Function CanComplete(state As DepartmentStepState) As Boolean
        Return state = DepartmentStepState.Called
    End Function

    Public Shared Function CanForward(state As DepartmentStepState) As Boolean
        Return state = DepartmentStepState.Called
    End Function
End Class
