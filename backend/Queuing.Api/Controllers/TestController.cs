using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Queuing.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TestController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetValues()
        {
            var data = new string[] { "Test api... TITEEEE" };
            return Ok(data);
        }
    }
}
