namespace Queuing.Api.Services;

public static class DisplayMediaValidation
{
    public const long MaxUploadBytes = 250L * 1024 * 1024;

    public static bool IsSupportedVideoUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Scheme == Uri.UriSchemeHttps &&
        !string.IsNullOrEmpty(uri.Host) &&
        string.IsNullOrEmpty(uri.UserInfo) &&
        (uri.AbsolutePath.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ||
         uri.AbsolutePath.EndsWith(".webm", StringComparison.OrdinalIgnoreCase));

    public static string? GetVideoExtension(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 8 && header[4] == (byte)'f' && header[5] == (byte)'t' &&
            header[6] == (byte)'y' && header[7] == (byte)'p') return ".mp4";
        if (header.Length >= 4 && header[0] == 0x1A && header[1] == 0x45 &&
            header[2] == 0xDF && header[3] == 0xA3) return ".webm";
        return null;
    }
}
