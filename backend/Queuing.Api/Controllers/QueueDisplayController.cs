using Microsoft.AspNetCore.Mvc;
using Queuing.Api.Models;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/queue/display")]
public sealed class QueueDisplayController(QueueDemoStore queueStore) : ControllerBase
{
    [HttpGet]
    public ActionResult<IEnumerable<QueueItemDto>> GetDisplaySnapshot([FromQuery] string? department)
    {
        var items = queueStore.GetActiveDisplayQueue()
            .Select(QueueItemDto.FromCore);

        if (!string.IsNullOrWhiteSpace(department) && !string.Equals(department, "all", StringComparison.OrdinalIgnoreCase))
        {
            items = items.Where(i => string.Equals(i.Department, department, StringComparison.OrdinalIgnoreCase));
        }

        return Ok(items);
    }

}
