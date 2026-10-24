using Queuing.Api.Services;
using Xunit;

namespace Queuing.Api.Tests;

public sealed class DisplayMediaValidationTests
{
    [Theory]
    [InlineData("https://media.example.org/welcome.mp4", true)]
    [InlineData("https://media.example.org/welcome.WEBM?download=1", true)]
    [InlineData("http://media.example.org/welcome.mp4", false)]
    [InlineData("https://media.example.org/watch?id=welcome", false)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("//media.example.org/welcome.mp4", false)]
    public void Accepts_only_absolute_https_direct_video_urls(string value, bool expected) =>
        Assert.Equal(expected, DisplayMediaValidation.IsSupportedVideoUrl(value));

    [Theory]
    [InlineData(new byte[] { 0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70 }, ".mp4")]
    [InlineData(new byte[] { 0x1A, 0x45, 0xDF, 0xA3, 0x93 }, ".webm")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47 }, null)]
    public void Detects_video_type_from_file_signature(byte[] header, string? expectedExtension) =>
        Assert.Equal(expectedExtension, DisplayMediaValidation.GetVideoExtension(header));
}
