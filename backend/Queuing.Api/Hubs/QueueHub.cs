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
        var displayType = Context.User?.FindFirst("display_type")?.Value;
        var generation = Context.User?.FindFirst("display_generation")?.Value;
        if (!Guid.TryParse(displayId, out var id) ||
            (displayType == "Department" && !Guid.TryParse(departmentId, out _)) ||
            displayType is not ("Department" or "Lobby") ||
            string.IsNullOrWhiteSpace(generation))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, DisplayGroupName(id, generation));
        await Clients.Caller.SendAsync("QueueChanged");
        await base.OnConnectedAsync();
    }

    public static string DisplayGroupName(Guid displayId, string generation) => $"display:{displayId:N}:{generation}";
}
