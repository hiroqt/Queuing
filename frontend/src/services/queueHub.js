import * as signalR from "@microsoft/signalr";
import { useEffect, useRef, useState } from "react";

/**
 * Fetch the latest active queue items from the REST fallback endpoint.
 */
export async function fetchDisplayQueue(department, signal) {
  const query = department && department !== "all" ? `?department=${encodeURIComponent(department)}` : "";
  const response = await fetch(`/api/queue/display${query}`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load queue display snapshot: ${response.statusText}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.activeItems || [];
}

/**
 * Post a call request to the server (invokes Hub broadcast to all screens).
 */
export async function callTicket(department = "Consultation", counterName = "Counter 01") {
  const response = await fetch("/api/queue/display/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ department, counterName }),
  });
  if (!response.ok) throw new Error("Failed to call ticket");
  return response.json();
}

/**
 * Post a recall request to the server (invokes Hub broadcast to all screens).
 */
export async function recallTicket(ticketNumber, counterName = "Counter 01") {
  const response = await fetch("/api/queue/display/recall", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketNumber, counterName }),
  });
  if (!response.ok) throw new Error("Failed to recall ticket");
  return response.json();
}

/**
 * Synthesize a two-tone chime alert via the Web Audio API.
 * Zero external audio asset dependencies.
 */
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return Promise.resolve();
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.28, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Tone 2: G5 (783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now + 0.22);
    gain2.gain.setValueAtTime(0.001, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.32, now + 0.26);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.72);

    return new Promise((resolve) => setTimeout(resolve, 750));
  } catch {
    return Promise.resolve();
  }
}

/**
 * Speak the announcement via the Web Speech API.
 */
export function announceTicket(ticketNumber, counterName) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    // Separate letters and digits for clear pronunciation: "A 1 0 1"
    const formattedTicket = ticketNumber.replace(/(\w)/g, "$1 ").replace(/\s+/g, " ").trim();
    const text = `Now calling ticket, ${formattedTicket}, to ${counterName}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.04;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech fallback
  }
}

/**
 * Custom hook to manage the public queue display board data and real-time updates.
 */
export function useQueueDisplay({ department = "all", soundEnabled = true }) {
  const [items, setItems] = useState([]);
  const [connectionState, setConnectionState] = useState("reconnecting"); // 'connected' | 'reconnecting' | 'disconnected'
  const [lastAlertEvent, setLastAlertEvent] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const connectionRef = useRef(null);
  const isSoundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    isSoundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const triggerCallAnnouncement = (item, type = "call") => {
    setLastAlertEvent({ type, item, timestamp: Date.now() });
    if (isSoundEnabledRef.current) {
      playChime().then(() => {
        announceTicket(item.ticketNumber, item.counterName);
      });
    }
  };

  // User gesture to unlock Web Audio context on kiosk screens
  const unlockAudio = () => {
    setAudioUnlocked(true);
    playChime();
  };

  useEffect(() => {
    let isCancelled = false;

    // Load initial snapshot from REST fallback
    const loadSnapshot = async () => {
      try {
        const data = await fetchDisplayQueue(department);
        if (!isCancelled && Array.isArray(data)) {
          setItems(data);
        }
      } catch {
        // Handled silently, connection/polling will retry
      }
    };
    loadSnapshot();

    // Create SignalR connection
    const hubConnection = new signalR.HubConnectionBuilder()
      .withUrl("/hubs/queue", {
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 1500, 3000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = hubConnection;

    hubConnection.on("QueueStateSnapshot", (snapshot) => {
      if (!isCancelled && Array.isArray(snapshot)) {
        setItems(snapshot);
      }
    });

    hubConnection.on("TicketCalled", (item) => {
      if (!isCancelled && item) {
        setItems((prev) => {
          const filtered = prev.filter((i) => i.ticketNumber !== item.ticketNumber);
          return [item, ...filtered];
        });
        triggerCallAnnouncement(item, "call");
      }
    });

    hubConnection.on("TicketRecalled", (item) => {
      if (!isCancelled && item) {
        setItems((prev) => {
          const filtered = prev.filter((i) => i.ticketNumber !== item.ticketNumber);
          return [item, ...filtered];
        });
        triggerCallAnnouncement(item, "recall");
      }
    });

    hubConnection.onreconnecting(() => {
      if (!isCancelled) setConnectionState("reconnecting");
    });

    hubConnection.onreconnected(() => {
      if (!isCancelled) {
        setConnectionState("connected");
        loadSnapshot();
      }
    });

    hubConnection.onclose(() => {
      if (!isCancelled) setConnectionState("disconnected");
    });

    // Start connection
    hubConnection
      .start()
      .then(() => {
        if (!isCancelled) setConnectionState("connected");
      })
      .catch(() => {
        if (!isCancelled) setConnectionState("disconnected");
      });

    // Fallback polling when disconnected
    const pollingInterval = setInterval(() => {
      if (connectionRef.current?.state !== signalR.HubConnectionState.Connected) {
        loadSnapshot();
      }
    }, 6000);

    return () => {
      isCancelled = true;
      clearInterval(pollingInterval);
      if (connectionRef.current) {
        connectionRef.current.stop().catch(() => {});
      }
    };
  }, [department]);

  // Filter items by department if specified
  const filteredItems = items.filter((item) => {
    if (!department || department === "all") return true;
    return item.department?.toLowerCase() === department.toLowerCase();
  });

  const currentCall = filteredItems[0] || null;
  const recentCalls = filteredItems.slice(1, 9);

  return {
    items: filteredItems,
    currentCall,
    recentCalls,
    connectionState,
    lastAlertEvent,
    audioUnlocked,
    unlockAudio,
  };
}
