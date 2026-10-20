using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Api.Hubs;
using Queuing.Core;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/admin/displays")]
[Authorize(Policy = QueueRoles.Admin)]
public sealed class AdminDisplaysController(QueueDbContext db, TimeProvider clock, IHubContext<QueueHub> hub) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(await db.DisplayDevices.AsNoTracking().OrderBy(device => device.Name)
            .Select(device => new AdminDisplayDto(device.Id, device.Name, device.DepartmentId, device.Active, device.CredentialHash != null))
            .ToArrayAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDisplayRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Departments.AnyAsync(department => department.Id == request.DepartmentId && department.Active, cancellationToken))
            return Problem(statusCode: 400, title: "Choose an active department.");
        var name = request.Name.Trim();
        if (name.Length < 2) return Problem(statusCode: 400, title: "Monitor name must contain at least two characters.");
        var display = new DisplayDevice { Name = name, DepartmentId = request.DepartmentId };
        db.DisplayDevices.Add(display);
        AddAudit("display.created", display.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/displays/{display.Id}", new AdminDisplayDto(display.Id, display.Name, display.DepartmentId, display.Active, false));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDisplayRequest request, CancellationToken cancellationToken)
    {
        var display = await db.DisplayDevices.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (display is null) return NotFound();
        var hadCredential = display.CredentialHash is not null;
        if (request.DepartmentId is { } departmentId &&
            !await db.Departments.AnyAsync(department => department.Id == departmentId && department.Active, cancellationToken))
            return Problem(statusCode: 400, title: "Choose an active department.");

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length < 2) return Problem(statusCode: 400, title: "Monitor name must contain at least two characters.");
            display.Name = name;
        }
        if (request.DepartmentId is { } newDepartmentId && newDepartmentId != display.DepartmentId)
        {
            display.DepartmentId = newDepartmentId;
            display.CredentialHash = null;
            display.PairingCodeHash = null;
            display.PairingExpiresAtUtc = null;
            display.PairedAtUtc = null;
        }
        if (request.Active.HasValue)
        {
            display.Active = request.Active.Value;
            if (!display.Active)
            {
                display.CredentialHash = null;
                display.PairingCodeHash = null;
                display.PairingExpiresAtUtc = null;
                display.PairedAtUtc = null;
            }
        }
        AddAudit("display.updated", display.Id);
        await db.SaveChangesAsync(cancellationToken);
        if (hadCredential && display.CredentialHash is null)
        {
            await hub.Clients.Group(QueueHub.DisplayGroupName(display.Id)).SendAsync("DisplayRevoked", cancellationToken);
        }
        return Ok(new AdminDisplayDto(display.Id, display.Name, display.DepartmentId, display.Active, display.CredentialHash is not null));
    }

    [HttpPost("{id:guid}/pairing-code")]
    public async Task<IActionResult> CreatePairingCode(Guid id, CancellationToken cancellationToken)
    {
        var display = await db.DisplayDevices.SingleOrDefaultAsync(item => item.Id == id && item.Active, cancellationToken);
        if (display is null) return NotFound();
        var hadCredential = display.CredentialHash is not null;
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(5));
        display.PairingCodeHash = DisplayDeviceAuthHandler.Hash(code);
        display.PairingExpiresAtUtc = clock.GetUtcNow().AddMinutes(10);
        display.CredentialHash = null;
        display.PairedAtUtc = null;
        AddAudit("display.pairing-code-created", display.Id);
        await db.SaveChangesAsync(cancellationToken);
        if (hadCredential)
        {
            await hub.Clients.Group(QueueHub.DisplayGroupName(display.Id)).SendAsync("DisplayRevoked", cancellationToken);
        }
        return Ok(new { code });
    }

    private void AddAudit(string action, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var actor) ? actor : null,
        Action = action, TargetType = "display", TargetId = id, CorrelationId = HttpContext.TraceIdentifier,
        OccurredAtUtc = clock.GetUtcNow()
    });
}

[ApiController]
[Route("api/v1/displays")]
public sealed class DisplayActivationController(QueueDbContext db, TimeProvider clock, IHubContext<QueueHub> hub) : ControllerBase
{
    [HttpPost("activate")]
    [AllowAnonymous]
    [EnableRateLimiting("pairing")]
    public async Task<IActionResult> Activate([FromBody] ActivateDisplayRequest request, CancellationToken cancellationToken)
    {
        var hash = DisplayDeviceAuthHandler.Hash(request.Code.Trim().ToUpperInvariant());
        var display = await db.DisplayDevices.SingleOrDefaultAsync(item => item.Active && item.PairingCodeHash == hash &&
            item.PairingExpiresAtUtc > clock.GetUtcNow(), cancellationToken);
        if (display is null) return Problem(statusCode: 400, title: "The pairing code is invalid or expired.");

        var hadCredential = display.CredentialHash is not null;
        var credential = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        display.CredentialHash = DisplayDeviceAuthHandler.Hash(credential);
        display.PairingCodeHash = null;
        display.PairingExpiresAtUtc = null;
        display.PairedAtUtc = clock.GetUtcNow();
        db.AuditRecords.Add(new AuditRecord
        {
            Action = "display.paired",
            TargetType = "display",
            TargetId = display.Id,
            CorrelationId = HttpContext.TraceIdentifier,
            OccurredAtUtc = clock.GetUtcNow()
        });
        await db.SaveChangesAsync(cancellationToken);
        Response.Cookies.Append(DisplayDeviceAuthHandler.CookieName, credential, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = TimeSpan.FromDays(30)
        });
        if (hadCredential)
        {
            await hub.Clients.Group(QueueHub.DisplayGroupName(display.Id)).SendAsync("DisplayRevoked", cancellationToken);
        }
        return Ok(new { paired = true });
    }

    [HttpPost("logout")]
    [Authorize(Policy = "DisplayDevice")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(DisplayDeviceAuthHandler.CookieName, new CookieOptions { Path = "/", SameSite = SameSiteMode.Lax, Secure = Request.IsHttps, HttpOnly = true });
        return NoContent();
    }

    [HttpGet("me/snapshot")]
    [Authorize(Policy = "DisplayDevice")]
    public async Task<IActionResult> GetSnapshot(CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirst("department_id")?.Value, out var departmentId)) return Forbid();
        var departmentName = await db.Departments.Where(item => item.Id == departmentId && item.Active)
            .Select(item => item.Name).SingleOrDefaultAsync(cancellationToken);
        if (departmentName is null) return Forbid();
        var items = await db.DepartmentSteps.AsNoTracking()
            .Where(step => step.DepartmentId == departmentId && step.Visit.CurrentStepId == step.Id &&
                (step.State == DepartmentStepState.Pending || step.State == DepartmentStepState.Called))
            .Include(step => step.Visit)
            .OrderBy(step => step.State)
            .ThenBy(step => step.AppointmentAtUtc == null)
            .ThenBy(step => step.AppointmentAtUtc)
            .ThenBy(step => step.EnteredAtUtc)
            .ThenBy(step => step.Visit.ClinicDate)
            .ThenBy(step => step.Visit.Sequence)
            .Select(step => new DisplayQueueTicket(step.Visit.VisitCode, step.State.ToString()))
            .ToArrayAsync(cancellationToken);
        return Ok(new DisplaySnapshotDto(departmentName,
            items.Where(item => item.Status == nameof(DepartmentStepState.Pending)).ToArray(),
            items.Where(item => item.Status == nameof(DepartmentStepState.Called)).ToArray()));
    }
}

public sealed record CreateDisplayRequest([Required, StringLength(100, MinimumLength = 2)] string Name, Guid DepartmentId);
public sealed record UpdateDisplayRequest([StringLength(100, MinimumLength = 2)] string? Name, Guid? DepartmentId, bool? Active);
public sealed record ActivateDisplayRequest([Required, StringLength(20, MinimumLength = 8)] string Code);
public sealed record AdminDisplayDto(Guid Id, string Name, Guid DepartmentId, bool Active, bool Paired);
public sealed record DisplayQueueTicket(string VisitCode, string Status);
public sealed record DisplaySnapshotDto(string DepartmentName, DisplayQueueTicket[] Waiting, DisplayQueueTicket[] Called);
