using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Api.Services;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class KiosksController(QueueDbContext db, TimeProvider clock, VisitIssuanceService visitIssuance) : ControllerBase
{
    [HttpGet("admin/kiosks")]
    [Authorize(Policy = QueueRoles.Admin)]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(await db.KioskDevices.AsNoTracking().OrderBy(device => device.Name)
            .Select(device => new AdminKioskDto(device.Id, device.Name, device.Active, device.CredentialHash != null))
            .ToArrayAsync(cancellationToken));

    [HttpPost("admin/kiosks")]
    [Authorize(Policy = QueueRoles.Admin)]
    public async Task<IActionResult> Create([FromBody] CreateKioskRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (name.Length < 2) return Problem(statusCode: 400, title: "Kiosk name must contain at least two characters.");
        var kiosk = new KioskDevice { Name = name };
        db.KioskDevices.Add(kiosk);
        AddAdminAudit("kiosk.created", kiosk.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/v1/admin/kiosks/{kiosk.Id}", new AdminKioskDto(kiosk.Id, kiosk.Name, kiosk.Active, false));
    }

    [HttpPatch("admin/kiosks/{id:guid}")]
    [Authorize(Policy = QueueRoles.Admin)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateKioskRequest request, CancellationToken cancellationToken)
    {
        var kiosk = await db.KioskDevices.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (kiosk is null) return NotFound();
        if (request.Name is { } submittedName)
        {
            var name = submittedName.Trim();
            if (name.Length < 2) return Problem(statusCode: 400, title: "Kiosk name must contain at least two characters.");
            kiosk.Name = name;
        }
        if (request.Active == false)
        {
            kiosk.Active = false;
            ClearCredentials(kiosk);
        }
        else if (request.Active == true)
        {
            kiosk.Active = true;
        }
        AddAdminAudit("kiosk.updated", kiosk.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new AdminKioskDto(kiosk.Id, kiosk.Name, kiosk.Active, kiosk.CredentialHash is not null));
    }

    [HttpPost("admin/kiosks/{id:guid}/pairing-code")]
    [Authorize(Policy = QueueRoles.Admin)]
    public async Task<IActionResult> CreatePairingCode(Guid id, CancellationToken cancellationToken)
    {
        var kiosk = await db.KioskDevices.SingleOrDefaultAsync(item => item.Id == id && item.Active, cancellationToken);
        if (kiosk is null) return NotFound();
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(5));
        kiosk.PairingCodeHash = KioskDeviceAuthHandler.Hash(code);
        kiosk.PairingExpiresAtUtc = clock.GetUtcNow().AddMinutes(10);
        kiosk.CredentialHash = null;
        kiosk.PairedAtUtc = null;
        AddAdminAudit("kiosk.pairing-code-created", kiosk.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { code });
    }

    [HttpPost("kiosks/activate")]
    [AllowAnonymous]
    [EnableRateLimiting("pairing")]
    public async Task<IActionResult> Activate([FromBody] ActivateKioskRequest request, CancellationToken cancellationToken)
    {
        var hash = KioskDeviceAuthHandler.Hash(request.Code.Trim().ToUpperInvariant());
        var id = await db.KioskDevices.AsNoTracking()
            .Where(item => item.Active && item.PairingCodeHash == hash && item.PairingExpiresAtUtc > clock.GetUtcNow())
            .Select(item => (Guid?)item.Id)
            .SingleOrDefaultAsync(cancellationToken);
        if (id is null) return Problem(statusCode: 400, title: "The pairing code is invalid or expired.");

        var credential = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var now = clock.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var updated = await db.KioskDevices.Where(item => item.Id == id.Value && item.Active && item.PairingCodeHash == hash &&
                item.PairingExpiresAtUtc > now)
            .ExecuteUpdateAsync(update => update
                .SetProperty(item => item.CredentialHash, KioskDeviceAuthHandler.Hash(credential))
                .SetProperty(item => item.PairingCodeHash, (string?)null)
                .SetProperty(item => item.PairingExpiresAtUtc, (DateTimeOffset?)null)
                .SetProperty(item => item.PairedAtUtc, (DateTimeOffset?)now), cancellationToken);
        if (updated != 1) return Problem(statusCode: 400, title: "The pairing code is invalid or expired.");
        db.AuditRecords.Add(new AuditRecord
        {
            ActorKioskDeviceId = id,
            Action = "kiosk.paired",
            TargetType = "kiosk",
            TargetId = id.Value,
            CorrelationId = HttpContext.TraceIdentifier,
            OccurredAtUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        Response.Cookies.Append(KioskDeviceAuthHandler.CookieName, credential, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = TimeSpan.FromDays(30)
        });
        return Ok(new { paired = true });
    }

    [HttpGet("kiosk/choices")]
    [Authorize(Policy = QueueRoles.KioskDevicePolicy)]
    public async Task<IActionResult> Choices(CancellationToken cancellationToken)
    {
        var rows = await db.Services.AsNoTracking()
            .Where(service => service.Active && service.Department.Active)
            .OrderBy(service => service.Department.Name).ThenBy(service => service.Name)
            .Select(service => new
            {
                DepartmentId = service.DepartmentId,
                DepartmentName = service.Department.Name,
                ServiceId = service.Id,
                ServiceName = service.Name
            })
            .ToArrayAsync(cancellationToken);
        return Ok(rows.GroupBy(row => new { row.DepartmentId, row.DepartmentName })
            .Select(group => new KioskDepartmentChoice(
                group.Key.DepartmentId,
                group.Key.DepartmentName,
                group.Select(row => new KioskServiceChoice(row.ServiceId, row.ServiceName)).ToArray()))
            .ToArray());
    }

    [HttpPost("kiosk/visits")]
    [Authorize(Policy = QueueRoles.KioskDevicePolicy)]
    [EnableRateLimiting("kiosk-issue")]
    public async Task<IActionResult> Issue(
        [FromBody] KioskIssueVisitRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var kioskDeviceId)) return Unauthorized();
        var result = await visitIssuance.IssueAsync(
            new IssueVisitRequest(request.InitialServiceId, null),
            idempotencyKey,
            null,
            kioskDeviceId,
            HttpContext.TraceIdentifier,
            cancellationToken);
        if (result.Error is not null) return Problem(statusCode: result.StatusCode, title: result.Error);
        return result.WasReplay ? Ok(result.Receipt) : StatusCode(StatusCodes.Status201Created, result.Receipt);
    }

    [HttpPost("kiosk/logout")]
    [Authorize(Policy = QueueRoles.KioskDevicePolicy)]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(KioskDeviceAuthHandler.CookieName, new CookieOptions
        {
            Path = "/", SameSite = SameSiteMode.Lax, Secure = Request.IsHttps, HttpOnly = true
        });
        return NoContent();
    }

    private void AddAdminAudit(string action, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actor) ? actor : null,
        Action = action,
        TargetType = "kiosk",
        TargetId = id,
        CorrelationId = HttpContext.TraceIdentifier,
        OccurredAtUtc = clock.GetUtcNow()
    });

    private static void ClearCredentials(KioskDevice kiosk)
    {
        kiosk.PairingCodeHash = null;
        kiosk.PairingExpiresAtUtc = null;
        kiosk.CredentialHash = null;
        kiosk.PairedAtUtc = null;
    }
}

public sealed record AdminKioskDto(Guid Id, string Name, bool Active, bool Paired);
public sealed record KioskDepartmentChoice(Guid Id, string Name, KioskServiceChoice[] Services);
public sealed record KioskServiceChoice(Guid Id, string Name);
public sealed record CreateKioskRequest([Required, StringLength(100, MinimumLength = 2)] string Name);
public sealed record UpdateKioskRequest([StringLength(100, MinimumLength = 2)] string? Name, bool? Active);
public sealed record ActivateKioskRequest([Required, StringLength(20, MinimumLength = 8)] string Code);
public sealed record KioskIssueVisitRequest([Required] Guid InitialServiceId);
