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
 * Custom hook to manage the public queue display board data and real-time updates.
 */
export function useQueueDisplay({ department = "all" }) {
  const [items, setItems] = useState([]);
  const [connectionState, setConnectionState] = useState("connecting");
  const [lastAlertEvent, setLastAlertEvent] = useState(null);
  const connectionRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    let eventVersion = 0;
    const snapshotController = new AbortController();

    // Ignore a snapshot that started before a newer SignalR event arrived.
    const loadSnapshot = async () => {
      const requestVersion = eventVersion;
      try {
        const data = await fetchDisplayQueue(department, snapshotController.signal);
        if (!isCancelled && requestVersion === eventVersion && Array.isArray(data)) {
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
      if (!isCancelled && eventVersion === 0 && Array.isArray(snapshot)) {
        setItems(snapshot);
      }
    });

    hubConnection.on("TicketCalled", (item) => {
      if (!isCancelled && item) {
        eventVersion += 1;
        setItems((prev) => {
          const filtered = prev.filter((i) => i.ticketNumber !== item.ticketNumber);
          return [item, ...filtered];
        });
        setLastAlertEvent({ item, timestamp: Date.now() });
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
    const startPromise = hubConnection
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
      snapshotController.abort();
      if (connectionRef.current === hubConnection) {
        connectionRef.current = null;
      }
      if (hubConnection.state === signalR.HubConnectionState.Connecting) {
        void startPromise.then(() => hubConnection.stop()).catch(() => {});
      } else {
        hubConnection.stop().catch(() => {});
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
  };
}
