using System.Net;
using Microsoft.AspNetCore.Http;

namespace Queuing.Api.Auth;

public static class LocalSetupAccess
{
    public static bool IsAllowed(bool enabled, string environmentName, IPAddress? remoteAddress, string? host)
    {
        if (!enabled || !string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase) ||
            !IsLoopback(remoteAddress))
        {
            return false;
        }

        return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            (IPAddress.TryParse(host, out var hostAddress) && IsLoopback(hostAddress));
    }

    public static bool IsAdminApiPath(PathString path) => path.StartsWithSegments("/api/v1/admin");

    private static bool IsLoopback(IPAddress? address)
    {
        if (address is null) return false;
        var normalized = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
        return IPAddress.IsLoopback(normalized);
    }
}
