import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { departmentApi, displaysApi } from "../../../api/client.js";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";

export default function DisplaysSection() {
  const { setPairingCode } = useOutletContext();
  const [departments, setDepartments] = useState([]);
  const [displays, setDisplays] = useState([]);
  const [videos, setVideos] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [displayType, setDisplayType] = useState("Department");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    }
  }

  async function addVideoUrl(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => displaysApi.addVideoUrl(data.get("videoUrl").trim()), "Video URL added to the lobby playlist.");
    if (result) form.reset();
  }

  async function uploadVideo(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("videoFile");
    if (!file?.size) { setError("Choose a video file to upload."); return; }
    const result = await act(() => displaysApi.uploadVideo(file), "Video uploaded to the lobby playlist.");
    if (result) form.reset();
  }

  async function issuePairingCode(display) {
    const result = await act(() => displaysApi.pairingCode(display.id), `Pairing code created for ${display.name}.`);
    if (result) setPairingCode(result.code ?? "");
  }

  const activeDepartments = departments.filter((item) => item.active);

  return (
    <section className="content-panel admin-section" aria-labelledby="displays-heading">
      <AdminSectionHeader
        id="displays-heading"
        eyebrow="WAITING ROOM DEVICES"
        title="Displays"
        countLabel={`${displays.length} registered`}
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cancel" : "Add display"}</button>}
      />
      <AdminFeedback error={error} message={message} />
      {loading && <p role="status" className="panel-description">Loading displays…</p>}
      {!loading && activeDepartments.length === 0 && <p className="panel-description">There are no active departments for lobby queues. <Link to="/admin/departments">Go to Departments</Link></p>}
      {!loading && displays.length === 0 && <p className="panel-description">No displays are registered yet. Add a department monitor or a lobby display and create a pairing code.</p>}
      {showCreate && <form className="admin-inline-form" onSubmit={createDisplay}>
        <h3>Register display</h3>
        <label htmlFor="display-name">Display name</label>
        <input id="display-name" name="name" required minLength="2" maxLength="100" />
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
        <button className="button button-dark" type="submit">Save display</button>
      </form>}
      <div className="admin-record-list">{displays.map((display) => (
        <article className="admin-record" key={display.id}>
          <div className="admin-record-summary">
            <strong>{display.name}</strong>
            <span>{display.type === "Lobby" || !display.departmentId ? "All active departments" : departments.find((item) => item.id === display.departmentId)?.name ?? "Department unavailable"}</span>
            <span className="enabled-label">{display.active ? "Active" : "Revoked"}</span>
          </div>
          <div className="admin-form-actions">
            <button className="text-button" type="button" onClick={() => issuePairingCode(display)} disabled={!display.active}>Create pairing code</button>
            {display.active && <button className="text-button" type="button" onClick={() => act(() => displaysApi.update(display.id, { active: false }), `${display.name} revoked.`)}>Revoke</button>}
          </div>
        </article>
      ))}</div>
      <div className="admin-video-playlist">
        <div className="section-heading"><div><p className="eyebrow">LOBBY DISPLAY</p><h2>Information video playlist</h2></div><span className="count-label">{videos.length} videos</span></div>
        <p className="panel-description">Videos play in the order added and repeat. Uploaded MP4/WebM files can be up to 250 MiB. Audible playback starts with one press on the lobby display.</p>
        <form className="admin-inline-form" onSubmit={addVideoUrl}>
          <label htmlFor="display-video-url">Direct HTTPS video URL (.mp4 or .webm)</label>
          <input id="display-video-url" name="videoUrl" type="url" placeholder="https://example.org/clinic-info.mp4" required maxLength="2048" />
          <button className="button button-dark" type="submit">Add video URL</button>
        </form>
        <form className="admin-inline-form" onSubmit={uploadVideo}>
          <label htmlFor="display-video-file">Upload a video (MP4 or WebM, up to 250 MiB)</label>
          <input id="display-video-file" name="videoFile" type="file" accept="video/mp4,video/webm" />
          <button className="button button-dark" type="submit">Upload video</button>
        </form>
        {videos.length > 0 && <ul className="admin-video-list">{videos.map((video) => <li key={video.id}>
          <span><strong>{video.name}</strong><small>{video.url ? "Direct URL" : video.contentType}</small></span>
          <button className="text-button" type="button" onClick={() => act(() => displaysApi.deleteVideo(video.id), `${video.name} removed from the playlist.`)}>Remove</button>
        </li>)}</ul>}
      </div>
    </section>
  );
}
