using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Queuing.Api.Data;

namespace Queuing.Api.Auth;

public sealed class DisplayDeviceAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    System.Text.Encodings.Web.UrlEncoder encoder,
    QueueDbContext db)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "DisplayDevice";
    public const string CookieName = "Queuing.Display";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(CookieName, out var credential) || string.IsNullOrWhiteSpace(credential))
        {
            return AuthenticateResult.NoResult();
        }

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credential)));
        var device = await db.DisplayDevices.AsNoTracking()
            .Where(item => item.Active && item.CredentialHash == hash)
            .Select(item => new { item.Id, item.DepartmentId })
            .SingleOrDefaultAsync(Context.RequestAborted);
        if (device is null)
        {
            return AuthenticateResult.Fail("Display pairing is no longer active.");
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, device.Id.ToString()),
            new Claim(ClaimTypes.Name, "paired-display"),
            new Claim("department_id", device.DepartmentId.ToString())
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }

    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
