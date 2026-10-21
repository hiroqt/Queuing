using System.Net;
using Queuing.Api.Auth;
using Xunit;

namespace Queuing.Api.Tests;

public sealed class LocalSetupAccessTests
{
    [Theory]
    [InlineData("127.0.0.1", "127.0.0.1")]
    [InlineData("::1", "localhost")]
    [InlineData("::ffff:127.0.0.1", "127.0.0.1")]
    public void Allows_enabled_development_requests_only_when_both_addresses_are_loopback(
        string remoteAddress,
        string host)
    {
        Assert.True(LocalSetupAccess.IsAllowed(true, "Development", IPAddress.Parse(remoteAddress), host));
    }

    [Theory]
    [InlineData(false, "Development", "127.0.0.1", "127.0.0.1")]
    [InlineData(true, "Production", "127.0.0.1", "127.0.0.1")]
    [InlineData(true, "Development", "192.168.1.20", "127.0.0.1")]
    [InlineData(true, "Development", "127.0.0.1", "clinic.example")]
    public void Denies_disabled_non_development_or_non_loopback_requests(
        bool enabled,
        string environment,
        string remoteAddress,
        string host)
    {
        Assert.False(LocalSetupAccess.IsAllowed(enabled, environment, IPAddress.Parse(remoteAddress), host));
    }

    [Theory]
    [InlineData("/api/v1/admin/services", true)]
    [InlineData("/api/v1/admin/departments", true)]
    [InlineData("/api/v1/auth/csrf", false)]
    [InlineData("/api/v1/auth/session", false)]
    [InlineData("/api/v1/departments/00000000-0000-0000-0000-000000000001/queue", false)]
    [InlineData("/api/v1/administer", false)]
    public void Limits_setup_principal_to_admin_api_paths(string path, bool expected)
    {
        Assert.Equal(expected, LocalSetupAccess.IsAdminApiPath(new Microsoft.AspNetCore.Http.PathString(path)));
    }
}
