import { useCallback, useEffect, useRef, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { Link, useNavigate } from "react-router";
import { displaysApi, refreshRequestToken } from "../../api/client.js";

export default function LobbyDisplayPage() {
  const [departments, setDepartments] = useState(null);
  const [videos, setVideos] = useState([]);
  const [videoIndex, setVideoIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState("");
  const [videoError, setVideoError] = useState("");
  const videoRef = useRef(null);
  const hubRef = useRef(null);
  const navigate = useNavigate();
  const video = videos[videoIndex];

  const clearDisplay = useCallback(() => {
    setDepartments(null);
    setVideos([]);
    setStarted(false);
    videoRef.current?.pause();
    videoRef.current?.removeAttribute("src");
    videoRef.current?.load();
    void hubRef.current?.stop();
  }, []);

  const refresh = useCallback(async (signal) => {
    try {
      const queue = await displaysApi.lobbySnapshot(signal);
      setDepartments(queue);
      setError("");
      try {
        const playlist = await displaysApi.lobbyVideos(signal);
        setVideos(playlist);
        setVideoIndex((index) => Math.min(index, Math.max(0, playlist.length - 1)));
        setVideoError("");
      } catch (cause) {
        if (cause.name === "AbortError") return;
        if (cause.status === 401 || cause.status === 403) {
          clearDisplay();
          setError("This lobby display is not paired or its access was revoked.");
        } else {
          setVideos([]);
          setVideoError("The information playlist is unavailable; queue information is still live.");
        }
      }
    } catch (cause) {
      if (cause.name !== "AbortError") {
        if (cause.status === 401 || cause.status === 403) {
          clearDisplay();
          setError("This lobby display is not paired or its access was revoked.");
        } else setError(cause.message);
      }
    }
  }, [clearDisplay]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const hub = new HubConnectionBuilder().withUrl("/hubs/displays", { withCredentials: true }).withAutomaticReconnect([0, 2000, 5000, 10000]).configureLogging(LogLevel.Warning).build();
    hubRef.current = hub;
    const reload = () => { if (active) void refresh(controller.signal); };
    hub.on("QueueChanged", reload);
    hub.on("DisplayRevoked", () => {
      if (!active) return;
      clearDisplay();
      setError("This lobby display is not paired or its access was revoked.");
      setConnection("disconnected");
      void hub.stop();
    });
    hub.onreconnecting(() => active && setConnection("reconnecting"));
    hub.onreconnected(() => { if (active) { setConnection("connected"); reload(); } });
    hub.onclose(() => active && setConnection("disconnected"));
    Promise.resolve().then(() => active && refresh(controller.signal));
    hub.start().then(() => { if (active) { setConnection("connected"); reload(); } })
      .catch(() => active && setConnection("disconnected"));
    const retry = window.setInterval(() => {
      if (hub.state !== "Connected") {
        reload();
        if (hub.state === "Disconnected") hub.start().then(() => active && setConnection("connected")).catch(() => {});
      }
    }, 10000);
    const refreshSnapshot = window.setInterval(reload, 30000);
    return () => {
      active = false;
      window.clearInterval(retry);
      window.clearInterval(refreshSnapshot);
      controller.abort();
      if (hubRef.current === hub) hubRef.current = null;
      void hub.stop();
    };
  }, [clearDisplay, refresh]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !started;
    videoRef.current.play().catch(() => setVideoError("Video could not start automatically. Use the playback control to try again."));
  }, [started, video?.id]);

  async function startPlayback() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    try {
      await video.play();
      setStarted(true);
      setVideoError("");
    } catch {
      setVideoError("Press Start on this display to allow video and sound.");
    }
  }

  function advanceVideo() {
    if (videos.length < 2) {
      const video = videoRef.current;
      if (video) { video.currentTime = 0; void video.play().catch(() => setVideoError("Video playback stopped. Press Start to try again.")); }
      return;
    }
    setVideoIndex((index) => (index + 1) % videos.length);
    setVideoError("");
  }

  async function unpair() {
    try {
      await refreshRequestToken();
      await displaysApi.logout();
      navigate("/display/pair", { replace: true });
    } catch (cause) { setError(cause.message); }
  }

  return <main className="paired-display-page lobby-display-page">
    <header className="paired-display-header">
      <div><p className="eyebrow eyebrow-light">CLINIC QUEUE · LOBBY</p><h1>Now serving</h1><p>Active departments · waiting room information</p></div>
      <div className="display-connection"><span className={`connection-dot connection-${connection}`} aria-hidden="true" />Connection: {connection}</div>
      <button className="button button-quiet" type="button" onClick={unpair}>Unpair display</button>
    </header>
    {error && <p className="display-error" role="alert">{error} <Link to="/display/pair">Pair this display</Link></p>}
    <div className="lobby-display-layout">
      <section className="lobby-departments" aria-label="Active department queues">
        {departments?.map((department) => <article className="lobby-department" key={department.departmentName}>
          <header><h2>{department.departmentName}</h2><span>NOW CALLING</span></header>
          <p className="lobby-called">{department.called ?? "—"}</p>
          <p className="lobby-waiting-label">WAITING</p>
          <ol>{department.waiting.map((code) => <li key={code}>{code}</li>)}</ol>
          {department.waiting.length === 0 && <p className="lobby-empty">No one waiting</p>}
        </article>)}
        {departments?.length === 0 && <p className="display-waiting">No departments are active.</p>}
        {!departments && !error && <p role="status">Loading active department queues…</p>}
      </section>
      <section className="lobby-video-panel" aria-label="Information video">
        <p className="eyebrow eyebrow-light">INFORMATION</p>
        {video ? <video key={video.id} ref={videoRef} src={video.url} autoPlay controls playsInline muted={!started} onEnded={advanceVideo} onError={() => setVideoError("This video could not play on this display.")} aria-label="Clinic information video" /> : <div className="lobby-video-empty">Clinic information videos will appear here.</div>}
        {videoError && <p className="display-error" role="status">{videoError}</p>}
        {video && (!started || videoError) && <button className="button button-primary lobby-start" type="button" onClick={startPlayback}>{started ? "Retry video" : videoError ? "Play video with sound" : "Enable video sound"}</button>}
        <p className="lobby-playlist-count">{videos.length ? `Video ${videoIndex + 1} of ${videos.length}` : "Queue information remains available without video"}</p>
      </section>
    </div>
    <footer className="board-footer"><span>Anonymous visit codes only</span><span>Snapshot refreshes after queue updates</span></footer>
  </main>;
}
