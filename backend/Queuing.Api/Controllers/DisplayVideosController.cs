using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Auth;
using Queuing.Api.Data;
using Queuing.Api.Hubs;
using Queuing.Api.Services;

namespace Queuing.Api.Controllers;

[ApiController]
[Route("api/v1/admin/display-videos")]
[Authorize(Policy = QueueRoles.Admin)]
public sealed class DisplayVideosController(
    QueueDbContext db,
    TimeProvider clock,
    IConfiguration configuration,
    IWebHostEnvironment environment,
    IHubContext<QueueHub> hub,
    ILogger<DisplayVideosController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(await db.DisplayVideos.AsNoTracking().OrderBy(video => video.CreatedAtUtc).ThenBy(video => video.Id)
            .Select(video => new AdminDisplayVideoDto(video.Id, video.Name, video.Url, video.ContentType, video.CreatedAtUtc))
            .ToArrayAsync(cancellationToken));

    [HttpPost("urls")]
    public async Task<IActionResult> AddUrl([FromBody] CreateDisplayVideoUrlRequest request, CancellationToken cancellationToken)
    {
        if (!DisplayMediaValidation.IsSupportedVideoUrl(request.Url))
            return Problem(statusCode: 400, title: "Use an HTTPS URL ending in .mp4 or .webm.");
        var uri = new Uri(request.Url);
        var name = Path.GetFileName(Uri.UnescapeDataString(uri.AbsolutePath));
        var video = new DisplayVideo
        {
            Name = string.IsNullOrWhiteSpace(name) ? uri.Host : name[..Math.Min(name.Length, 160)],
            Url = uri.AbsoluteUri,
            ContentType = uri.AbsolutePath.EndsWith(".webm", StringComparison.OrdinalIgnoreCase) ? "video/webm" : "video/mp4",
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.DisplayVideos.Add(video);
        AddAudit("display-video.url-added", video.Id);
        await db.SaveChangesAsync(cancellationToken);
        await NotifyLobbyAsync(cancellationToken);
        return Created($"/api/v1/admin/display-videos/{video.Id}", ToDto(video));
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(DisplayMediaValidation.MaxUploadBytes + 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = DisplayMediaValidation.MaxUploadBytes + 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm, Required] IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0) return Problem(statusCode: 400, title: "Choose a non-empty video file.");
        if (file.Length > DisplayMediaValidation.MaxUploadBytes) return Problem(statusCode: 413, title: "Video files must be 250 MiB or smaller.");

        var id = Guid.NewGuid();
        var temporaryKey = $"{id:N}.uploading";
        var path = DisplayVideoStorage.PathFor(configuration, environment, temporaryKey);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        AdminDisplayVideoDto result;
        try
        {
            string? extension;
            await using (var input = file.OpenReadStream())
            {
                var header = new byte[8];
                var headerLength = await input.ReadAtLeastAsync(header, 8, throwOnEndOfStream: false, cancellationToken: cancellationToken);
                extension = DisplayMediaValidation.GetVideoExtension(header.AsSpan(0, headerLength));
                if (extension is null) return Problem(statusCode: 400, title: "The file must contain MP4 or WebM video data.");

                await using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
                await output.WriteAsync(header.AsMemory(0, headerLength), cancellationToken);
                await input.CopyToAsync(output, cancellationToken);
            }

            var storageKey = $"{id:N}{extension}";
            System.IO.File.Move(path, DisplayVideoStorage.PathFor(configuration, environment, storageKey));
            var name = Path.GetFileNameWithoutExtension(file.FileName);
            var video = new DisplayVideo
            {
                Id = id,
                Name = string.IsNullOrWhiteSpace(name) ? "Information video" : name[..Math.Min(name.Length, 160)],
                StorageKey = storageKey,
                ContentType = extension == ".webm" ? "video/webm" : "video/mp4",
                CreatedAtUtc = clock.GetUtcNow()
            };
            db.DisplayVideos.Add(video);
            AddAudit("display-video.uploaded", id);
            await db.SaveChangesAsync(cancellationToken);
            result = ToDto(video);
        }
        catch
        {
            DeleteQuietly(path);
            DeleteQuietly(DisplayVideoStorage.PathFor(configuration, environment, $"{id:N}.mp4"));
            DeleteQuietly(DisplayVideoStorage.PathFor(configuration, environment, $"{id:N}.webm"));
            throw;
        }
        await NotifyLobbyAsync(cancellationToken);
        return Created($"/api/v1/admin/display-videos/{id}", result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var video = await db.DisplayVideos.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (video is null) return NotFound();
        db.DisplayVideos.Remove(video);
        AddAudit("display-video.deleted", video.Id);
        await db.SaveChangesAsync(cancellationToken);
        if (video.StorageKey is not null) DeleteQuietly(DisplayVideoStorage.PathFor(configuration, environment, video.StorageKey));
        await NotifyLobbyAsync(cancellationToken);
        return NoContent();
    }

    private AdminDisplayVideoDto ToDto(DisplayVideo video) => new(video.Id, video.Name, video.Url, video.ContentType, video.CreatedAtUtc);

    private async Task NotifyLobbyAsync(CancellationToken cancellationToken)
    {
        try { await QueueOutboxDispatcher.NotifyLobbyDisplaysAsync(db, hub, cancellationToken); }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
        { logger.LogWarning(exception, "Lobby display refresh notification failed; displays will refresh on reconnect."); }
    }

    private void AddAudit(string action, Guid id) => db.AuditRecords.Add(new AuditRecord
    {
        ActorUserId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actor) ? actor : null,
        Action = action,
        TargetType = "display-video",
        TargetId = id,
        CorrelationId = HttpContext.TraceIdentifier,
        OccurredAtUtc = clock.GetUtcNow()
    });

    private void DeleteQuietly(string path)
    {
        try { if (System.IO.File.Exists(path)) System.IO.File.Delete(path); }
        catch (IOException exception) { logger.LogError(exception, "Could not remove a display video file after a failed or completed metadata operation."); }
        catch (UnauthorizedAccessException exception) { logger.LogError(exception, "Could not remove a display video file after a failed or completed metadata operation."); }
    }
}

public sealed record CreateDisplayVideoUrlRequest([Required, Url, StringLength(2048)] string Url);
public sealed record AdminDisplayVideoDto(Guid Id, string Name, string? Url, string ContentType, DateTimeOffset CreatedAtUtc);

public static class DisplayVideoStorage
{
    public static string PathFor(IConfiguration configuration, IWebHostEnvironment environment, string storageKey)
    {
        var extension = Path.GetExtension(storageKey);
        if (storageKey != Path.GetFileName(storageKey) ||
            !Guid.TryParseExact(Path.GetFileNameWithoutExtension(storageKey), "N", out _) ||
            extension is not (".mp4" or ".webm" or ".uploading"))
            throw new ArgumentException("Invalid display media storage key.", nameof(storageKey));
        var configuredPath = configuration["DisplayMedia:StoragePath"];
        var root = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(environment.ContentRootPath, "App_Data", "display-media")
            : Path.IsPathRooted(configuredPath) ? configuredPath : Path.Combine(environment.ContentRootPath, configuredPath);
        return Path.Combine(Path.GetFullPath(root), storageKey);
    }
}
