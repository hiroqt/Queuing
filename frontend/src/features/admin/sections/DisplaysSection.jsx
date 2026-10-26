import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { departmentApi, displaysApi } from "../../../api/client.js";
import AdminActions from "../components/AdminActions.jsx";
import AdminDialog from "../components/AdminDialog.jsx";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminListControls from "../components/AdminListControls.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";
import AdminStatusBadge from "../components/AdminStatusBadge.jsx";

export default function DisplaysSection() {
  const { setOneTimeNotice } = useOutletContext();
  const [departments, setDepartments] = useState([]);
  const [displays, setDisplays] = useState([]);
  const [videos, setVideos] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [activeView, setActiveView] = useState("displays");
  const [displayType, setDisplayType] = useState("Department");
  const [videoSource, setVideoSource] = useState("url");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, displayRows, videoRows] = await Promise.all([departmentApi.adminList(signal), displaysApi.list(signal), displaysApi.adminVideos(signal)]);
      setDepartments(departmentRows);
      setDisplays(displayRows);
      setVideos(videoRows);
    } catch (cause) {
      if (cause.name !== "AbortError") setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  async function act(action, success) {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      setMessage(success);
      await load();
      return result;
    } catch (cause) {
      setError(cause.message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function createDisplay(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => displaysApi.create({
      name: data.get("name").trim(),
      type: displayType,
      departmentId: displayType === "Department" ? data.get("departmentId") : null,
    }), displayType === "Lobby" ? "Lobby display created." : "Department monitor created.");
    if (result) {
      form.reset();
      setShowCreate(false);
      setDisplayType("Department");
    }
  }

  async function addVideoUrl(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => displaysApi.addVideoUrl(data.get("videoUrl").trim()), "Video URL added to the lobby playlist.");
    if (result) {
      form.reset();
      setShowAddVideo(false);
    }
  }

  async function uploadVideo(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("videoFile");
    if (!file?.size) { setError("Choose a video file to upload."); return; }
    if (file.size > 250 * 1024 * 1024) { setError("Choose a video smaller than 250 MiB."); return; }
    const result = await act(() => displaysApi.uploadVideo(file), "Video uploaded to the lobby playlist.");
    if (result) {
      form.reset();
      setShowAddVideo(false);
    }
  }

  async function issuePairingCode(display) {
    const result = await act(() => displaysApi.pairingCode(display.id), `Pairing code created for ${display.name}.`);
    if (result?.code) setOneTimeNotice({
      kind: "display",
      title: "Monitor pairing code",
      itemName: display.name,
      secret: result.code,
      guidance: "Enter this one-time code on the monitor pairing page.",
      href: "/display/pair",
      linkLabel: "Open monitor pairing page in a new tab",
    });
  }

  async function deleteDisplay() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    setError("");
    try {
      await displaysApi.delete(deleteTarget.id);
      setMessage(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      await load();
    } catch (cause) {
      setDeleteError(cause.message);
    } finally {
      setDeleting(false);
    }
  }

  const activeDepartments = departments.filter((item) => item.active);

  return (
    <section className="content-panel admin-section" aria-labelledby="displays-heading">
      <AdminSectionHeader
        id="displays-heading"
        eyebrow="WAITING ROOM DEVICES"
        title="Displays"
        countLabel={`${displays.length} registered`}
        action={activeView === "displays" && <button className="button button-dark" type="button" onClick={() => setShowCreate(true)} disabled={loading}>Add display</button>}
      />
      <AdminFeedback error={showCreate || showAddVideo ? "" : error} message={message} />
      {loading && <p role="status" className="panel-description">Loading displays…</p>}
      <div className="admin-section-selector" role="group" aria-label="Display tools">
        <button type="button" aria-pressed={activeView === "displays"} onClick={() => { setActiveView("displays"); setShowCreate(false); setShowAddVideo(false); }}>Displays <span>({displays.length})</span></button>
        <button type="button" aria-pressed={activeView === "playlist"} onClick={() => { setActiveView("playlist"); setShowCreate(false); setShowAddVideo(false); }}>Lobby video playlist <span>({videos.length})</span></button>
      </div>
      {activeView === "displays" && <>
        {!loading && activeDepartments.length === 0 && <p className="panel-description">There are no active departments for lobby queues. <Link to="/admin/departments">Go to Departments</Link></p>}
        {!loading && displays.length === 0 && <p className="panel-description">No displays are registered yet. Add a department monitor or a lobby display and create a pairing code.</p>}
        {displays.length > 0 && <AdminListControls items={displays} searchLabel="displays" getSearchText={(display) => `${display.name} ${display.type} ${display.type === "Lobby" || !display.departmentId ? "All active departments" : departments.find((item) => item.id === display.departmentId)?.name ?? ""}`} getStatus={(item) => item.active ? "active" : "inactive"}>
          {(filteredDisplays) => <div className="admin-record-list">{filteredDisplays.map((display) => (
            <article className="admin-record" key={display.id}>
              <div className="admin-record-summary"><strong>{display.name}</strong><AdminStatusBadge status={display.active ? "active" : "revoked"} /></div>
              <div className="admin-record-details"><span>{display.type === "Lobby" || !display.departmentId ? "Lobby display · All active departments" : `Department monitor · ${departments.find((item) => item.id === display.departmentId)?.name ?? "Department unavailable"}`}</span></div>
              <AdminActions>
                {display.active && <button className="text-button" type="button" disabled={submitting} onClick={() => issuePairingCode(display)}>Create pairing code</button>}
                <button className="text-button" type="button" disabled={submitting} onClick={() => {
                  const active = !display.active;
                  return act(() => displaysApi.update(display.id, { active }), `${display.name} ${active ? "reactivated" : "revoked"}.`);
                }}>{display.active ? "Revoke display" : "Reactivate display"}</button>
                <button className="text-button danger-button" type="button" disabled={submitting} onClick={() => { setDeleteError(""); setDeleteTarget(display); }}>Delete display</button>
              </AdminActions>
            </article>
          ))}</div>}
        </AdminListControls>}
      </>}
      {activeView === "playlist" && <div className="admin-video-playlist">
        <div className="section-heading"><div><p className="eyebrow">LOBBY DISPLAY</p><h3>Information video playlist</h3></div><div className="admin-section-tools"><span className="count-label">{videos.length} videos</span><button className="button button-dark" type="button" onClick={() => setShowAddVideo(true)}>Add video</button></div></div>
        <p className="panel-description">Videos play in the order added and repeat. Upload an MP4 or WebM up to 250 MiB, or provide a direct HTTPS video URL.</p>
        {!loading && videos.length === 0 && <p className="panel-description">No lobby videos yet. Add a video to start the playlist.</p>}
        {videos.length > 0 && <AdminListControls items={videos} searchLabel="videos" getSearchText={(video) => `${video.name} ${video.url ?? ""} ${video.contentType ?? ""}`}>
          {(filteredVideos) => <ul className="admin-video-list">{filteredVideos.map((video) => <li key={video.id}>
            <span><strong>{video.name}</strong><small>{video.url ? "Direct URL" : video.contentType}</small></span>
            <AdminActions><button className="text-button danger-button" type="button" disabled={submitting} onClick={() => act(() => displaysApi.deleteVideo(video.id), `${video.name} removed from the playlist.`)}>Remove video</button></AdminActions>
          </li>)}</ul>}
        </AdminListControls>}
      </div>}
      {showCreate && <AdminDialog title="Register display" onClose={() => { setShowCreate(false); setDisplayType("Department"); }} busy={submitting}>
        <form onSubmit={createDisplay}>
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" name="name" required minLength="2" maxLength="100" autoFocus />
          <label htmlFor="display-type">Display type</label>
          <select id="display-type" value={displayType} onChange={(event) => setDisplayType(event.target.value)}>
            <option value="Department">Department monitor</option>
            <option value="Lobby">Lobby display</option>
          </select>
          {displayType === "Department" && <>
            <label htmlFor="display-department">Assigned department</label>
            <select id="display-department" name="departmentId" required defaultValue="">
              <option value="" disabled>Select a department</option>
              {activeDepartments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </>}
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Saving display…" : "Save display"}</button><button className="button button-quiet" type="button" onClick={() => { setShowCreate(false); setDisplayType("Department"); }} disabled={submitting}>Cancel</button></div>
        </form>
      </AdminDialog>}
      {showAddVideo && <AdminDialog title="Add lobby video" onClose={() => setShowAddVideo(false)} busy={submitting}>
        <form onSubmit={videoSource === "url" ? addVideoUrl : uploadVideo}>
          <label htmlFor="video-source">Video source</label>
          <select id="video-source" value={videoSource} onChange={(event) => setVideoSource(event.target.value)}>
            <option value="url">Direct HTTPS URL</option>
            <option value="upload">Upload a file</option>
          </select>
          {videoSource === "url"
            ? <><label htmlFor="display-video-url">Direct HTTPS video URL (.mp4 or .webm)</label><input id="display-video-url" name="videoUrl" type="url" placeholder="https://example.org/clinic-info.mp4" required maxLength="2048" autoFocus /></>
            : <><label htmlFor="display-video-file">Video file (MP4 or WebM, up to 250 MiB)</label><input id="display-video-file" name="videoFile" type="file" accept="video/mp4,video/webm" required autoFocus /></>}
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? videoSource === "url" ? "Adding video…" : "Uploading video…" : videoSource === "url" ? "Add video" : "Upload video"}</button><button className="button button-quiet" type="button" onClick={() => setShowAddVideo(false)} disabled={submitting}>Cancel</button></div>
        </form>
      </AdminDialog>}
      {deleteTarget && <div className="confirmation-backdrop"><section className="confirmation-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-display-heading" aria-describedby="delete-display-description" onKeyDown={(event) => { if (event.key === "Escape" && !deleting) setDeleteTarget(null); }}><h3 id="delete-display-heading">Delete {deleteTarget.name}?</h3><p id="delete-display-description">This permanently removes the display and its pairing. The device will lose access and must be registered again to reconnect.</p>{deleteError && <p className="confirmation-error" role="alert">{deleteError}</p>}<div className="admin-form-actions"><button className="button button-dark danger-confirm" type="button" disabled={deleting} onClick={deleteDisplay}>{deleting ? "Deleting…" : "Delete display"}</button><button className="button button-quiet" type="button" autoFocus disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button></div></section></div>}
    </section>
  );
}
