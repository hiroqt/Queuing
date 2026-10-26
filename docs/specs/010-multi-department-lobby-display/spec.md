# SPEC-010 — Multi-department lobby display

**Status:** Approved · implementation added; verification incomplete · **Date:** 2026-10-24
**Extends:** [SPEC-005](../005-forwarding-clinic-queue/spec.md), [SPEC-006](../006-service-station-admin-config/spec.md)

**Current follow-up:** [SPEC-012](../012-department-ticket-numbering/spec.md) adds Department ticket numbers to snapshots and changes lobby video to muted autoplay, with a display-side action to enable sound.

## Goal

Add a paired lobby display that presents every active Department alongside its current call and a short waiting list, with an audible rotating information-video playlist. Keep the existing paired department monitor scoped to one Department.

## Decisions from the owner

- Provide both a lobby display and the existing department-only monitors.
- Include every active Department automatically; do not configure a Department selection list for the lobby.
- Show one current called visit code per Department (the most recently called among steps still in `Called`; blank when none) and up to three waiting visit codes in the existing Department display order.
- Admin manages multiple playlist entries. Entries can be direct video-file URLs or uploaded video files. Play sequentially and repeat.
- Keep video audio enabled. A one-time Start action on the lobby display itself unlocks audible playback for the browser session; an Admin-page action cannot grant that browser permission.
- Store uploaded media on the API host's local filesystem, with metadata in MySQL. Keep uploads out of the web root and serve them only to paired lobby displays.

## Scope

- Admin registers, pairs, revokes, and names lobby displays using the existing display workflow; existing department monitors retain their one-Department assignment and behavior. Admin can permanently delete either display type after confirmation; this removes its device record and pairing, while preserving the audit record.
- Admin can add direct HTTPS video-file URLs, upload supported video files, list playlist entries, and remove an entry. Playlist order is entry creation order; manual reordering and per-screen playlists are excluded.
- Lobby snapshot returns active Departments, each Department's latest call (or empty), and up to three waiting codes. Queue state remains database-backed and anonymous.
- Lobby display refreshes from an authorized snapshot after connect/reconnect and queue or Department configuration changes. Queue and Department invalidations use the transactional outbox; a 30-second snapshot refresh covers missed notifications and playlist updates.
- Display videos advance sequentially, loop at playlist end, and play with audio after the one-time Start action. Queue information remains visible while the playlist or a video is stopped, loading, unavailable, or failing.

## Safety and data boundaries

- Lobby device credentials are revocable and distinguishable from department monitor credentials. Only an active paired lobby device receives lobby-specific SignalR invalidations or can read the all-active-department projection and uploaded media; department devices remain limited to their assigned Department.
- Queue projection contains Department name, anonymous visit code, and call/waiting status only.
- URL entries must be absolute HTTPS URLs to browser-playable video files; no embedded pages, arbitrary HTML, scripts, or server-side URL fetching.
- Uploads accept MP4/WebM video only, with a 250 MiB per-file limit. Generate storage names server-side, verify content type/signature, use bounded streaming, and never trust client filenames or MIME declarations.
- Store files outside the static web root, serve with a fixed video content type and byte-range support only under the paired-lobby policy, and delete the file only after its metadata removal succeeds.
- Local filesystem storage assumes a single API host with persistent writable storage. Shared/multi-instance or production hosting requires a separately approved storage design.
- Browsers may block autoplay with sound until a user gesture. Do not claim audible autoplay before the lobby display's one-time Start action.
- Credential-generation SignalR groups prevent later broadcasts reaching revoked/re-paired sockets. One invalidation already in flight during revocation may still arrive; it contains no queue data.

## Contracts and implementation shape

- Extend the existing `DisplayDevice` record with a device type and nullable Department assignment; migrate all existing rows to the department type without changing their pairing credentials or assignments.
- Keep the existing pairing code, device cookie, revocation, and display SignalR hub. Add a lobby-specific snapshot/media authorization check; omit `department_id` for lobby identities and reject them from department snapshots (and department identities from lobby snapshots/media).
- Add an admin-managed global playlist metadata table with URL or generated upload key, display name, content type, and creation time. Local media path is an application setting, defaulting to a persistent `App_Data/display-media` directory outside `wwwroot`.
- Add admin playlist list/add/remove endpoints; upload uses multipart form data and CSRF. Add paired-lobby snapshot and media endpoints. Do not alter queue command, numbering, or appointment behavior.
- Reuse the existing React admin Displays section and display pairing flow. Add a lobby display route and view; preserve the current department display route.

## Acceptance criteria

1. Admin can register, pair, and revoke a lobby display; existing department monitor creation/pairing/revocation remains compatible.
2. The lobby includes all and only active Departments without manual assignments; activating/deactivating a Department is reflected on refresh.
3. Each Department card shows the most recently called code among currently `Called` visits, if any, and no more than its first three waiting codes in the existing Department display order (appointment time first, then entry time, clinic date, and sequence). Future appointments remain displayed as waiting tickets.
4. A department-paired monitor cannot read another Department, the lobby projection, or uploaded media. A lobby-paired device can read the public projection but no admin/staff data. Revocation blocks lobby snapshots, media, and SignalR access.
5. Admin can add multiple valid HTTPS direct-video URLs and upload MP4/WebM under the size limit, view playlist order, and remove entries. Invalid URL schemes, oversized files, non-video content, and spoofed file types fail with a safe validation error.
6. Uploaded files survive API restarts when the configured local storage persists; media is not accessible through an unpaired or department-only display.
7. After one Start action, videos play sequentially with sound and repeat. Queue data stays visible without a playlist or when a video fails. Browser restrictions and unsupported formats produce a usable message and retry path.
8. Queue changes and Department create/rename/activation changes commit an outbox invalidation for paired displays; reconnect and periodic snapshot refresh reload authoritative state.
9. The lobby is readable and keyboard-operable at supported display sizes; video controls/start state are accessible and the information layout remains useful while video playback is unavailable.
10. An Admin can permanently delete a registered display after confirming; the API records the deletion, removes its pairing, notifies a connected device that access was revoked, and returns `404` for a missing display.

## Out of scope

- YouTube/Vimeo page embeds, arbitrary media URLs, captions/transcoding, manual playlist reordering, per-lobby playlists, remote object storage, multi-instance file sharing, production deployment, queue policy changes, or patient-identifying data.

## Verification note

- Verify target browser/video codec support during local UI validation; an MP4/WebM extension alone does not guarantee the encoded codec can play on every clinic display device.
- Backend compilation, MySQL migration application, and API integration remain unverified because this environment does not include the .NET SDK.

## Follow-up: Admin display deletion (approved 2026-10-27)

- Add `DELETE /api/v1/admin/displays/{id}` under the existing Admin-only display policy. Write `display.deleted` to the audit log with the deletion in the same save operation.
- Remove the display record and its pairing. Notify a currently paired device with the existing `DisplayRevoked` event after the delete commits; notification failure must not report the committed deletion as failed.
- Place **Delete display** in the row's Actions menu and require an accessible confirmation dialog that explains the device must be registered again to reconnect. Keep the dialog open and show the API error if deletion fails.
