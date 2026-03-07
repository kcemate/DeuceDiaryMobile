import { useEffect, useRef, useCallback, useState } from "react";

const WS_URL =
  (process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001")
    .replace(/^http/, "ws") + "/ws";

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const MAX_RETRIES = 10;

type DeuceLoggedEvent = {
  type: "deuce_logged";
  message: string;
  entry: any;
  userId: string;
};

export type ConnectionState = "connecting" | "connected" | "disconnected";

/**
 * WebSocket hook with exponential backoff reconnection and heartbeat.
 * Connects to the WS endpoint, joins a group channel, and calls
 * onMessage for incoming events.
 */
export function useGroupSocket(
  groupId: string | null,
  onMessage?: (event: DeuceLoggedEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

  // Keep onMessage ref current without triggering reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((ws: WebSocket) => {
    clearHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
        heartbeatTimeoutRef.current = setTimeout(() => {
          // No pong received — connection is stale, force close
          ws.close();
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [clearHeartbeat]);

  const connect = useCallback(() => {
    if (!groupId) return;

    setConnectionState("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      setConnectionState("connected");
      ws.send(JSON.stringify({ type: "join_group", groupId }));
      startHeartbeat(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") {
          // Heartbeat acknowledged — clear timeout
          if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
          }
          return;
        }
        if (data.type === "deuce_logged" && onMessageRef.current) {
          onMessageRef.current(data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      // silent — reconnect on close
    };

    ws.onclose = () => {
      clearHeartbeat();
      setConnectionState("disconnected");

      if (intentionalCloseRef.current) return;
      if (wsRef.current !== ws) return;

      if (retryCountRef.current >= MAX_RETRIES) {
        return;
      }

      const delay = Math.min(
        BASE_RECONNECT_MS * Math.pow(2, retryCountRef.current),
        MAX_RECONNECT_MS
      );
      retryCountRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (wsRef.current === ws || wsRef.current === null) {
          connect();
        }
      }, delay);
    };
  }, [groupId, startHeartbeat, clearHeartbeat]);

  useEffect(() => {
    intentionalCloseRef.current = false;
    connect();
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearHeartbeat();
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect, clearHeartbeat]);

  return { connectionState };
}
