using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Queuing.Api.Data;

namespace Queuing.Api.Auth;

public sealed class KioskDeviceAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    System.Text.Encodings.Web.UrlEncoder encoder,
    QueueDbContext db)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "KioskDevice";
    public const string CookieName = "Queuing.Kiosk";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(CookieName, out var credential) || string.IsNullOrWhiteSpace(credential))
            return AuthenticateResult.NoResult();

        var hash = Hash(credential);
        var deviceId = await db.KioskDevices.AsNoTracking()
            .Where(device => device.Active && device.CredentialHash == hash)
            .Select(device => (Guid?)device.Id)
            .SingleOrDefaultAsync(Context.RequestAborted);
        if (deviceId is null) return AuthenticateResult.Fail("Kiosk pairing is no longer active.");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, deviceId.Value.ToString()),
            new Claim(ClaimTypes.Name, "paired-kiosk")
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }

    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
