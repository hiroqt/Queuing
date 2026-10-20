using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Queuing.Api.Auth;

namespace Queuing.Api.Hubs;

[Authorize(Policy = "DisplayDevice")]
public sealed class QueueHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var displayId = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var departmentId = Context.User?.FindFirst("department_id")?.Value;
        if (!Guid.TryParse(displayId, out var id) || !Guid.TryParse(departmentId, out _))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, DisplayGroupName(id));
        await Clients.Caller.SendAsync("QueueChanged");
        await base.OnConnectedAsync();
    }

    public static string DisplayGroupName(Guid displayId) => $"display:{displayId:N}";
}
