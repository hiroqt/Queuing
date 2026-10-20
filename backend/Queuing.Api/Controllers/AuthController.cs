using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Auth;
using Queuing.Api.Data;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    SignInManager<QueueUser> signInManager,
    UserManager<QueueUser> userManager,
    QueueDbContext db,
    IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("csrf")]
    [AllowAnonymous]
    public IActionResult GetCsrfToken()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new { requestToken = tokens.RequestToken });
    }

    [HttpGet("session")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSession(CancellationToken cancellationToken)
    {
        if (User.Identity?.IsAuthenticated != true || !Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var userId))
        {
            return Ok(new { authenticated = false, userName = (string?)null, role = (string?)null, departmentIds = Array.Empty<Guid>(), mustChangePassword = false });
        }

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null || !user.Active)
        {
            await signInManager.SignOutAsync();
            return Ok(new { authenticated = false, userName = (string?)null, role = (string?)null, departmentIds = Array.Empty<Guid>(), mustChangePassword = false });
        }

        var roles = await userManager.GetRolesAsync(user);
        var departmentIds = await db.UserDepartments.AsNoTracking()
            .Where(assignment => assignment.UserId == user.Id)
            .Select(assignment => assignment.DepartmentId)
            .ToArrayAsync(cancellationToken);
        var requestToken = antiforgery.GetAndStoreTokens(HttpContext).RequestToken;
        return Ok(new
        {
            authenticated = true,
            userName = user.UserName,
            role = roles.FirstOrDefault(),
            departmentIds,
            mustChangePassword = user.MustChangePassword,
            requestToken
        });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await userManager.FindByNameAsync(request.UserName);
        if (user is null || !user.Active)
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "The username or password is incorrect.");
        }

        var result = await signInManager.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "The username or password is incorrect.");
        }

        return await GetSession(CancellationToken.None);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null || !user.Active)
        {
            return Unauthorized();
        }

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "The password could not be changed.", detail: string.Join(" ", result.Errors.Select(error => error.Description)));
        }

        user.MustChangePassword = false;
        await userManager.UpdateAsync(user);
        await signInManager.RefreshSignInAsync(user);
        return await GetSession(CancellationToken.None);
    }
}

public sealed record LoginRequest(string UserName, string Password);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
