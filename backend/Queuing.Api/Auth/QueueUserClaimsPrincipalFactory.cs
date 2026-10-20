using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Queuing.Api.Data;

namespace Queuing.Api.Auth;

public sealed class QueueUserClaimsPrincipalFactory(
    UserManager<QueueUser> userManager,
    RoleManager<IdentityRole<Guid>> roleManager,
    IOptions<IdentityOptions> options)
    : UserClaimsPrincipalFactory<QueueUser, IdentityRole<Guid>>(userManager, roleManager, options)
{
    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(QueueUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        identity.AddClaim(new Claim("must_change_password", user.MustChangePassword ? "true" : "false"));
        return identity;
    }
}
