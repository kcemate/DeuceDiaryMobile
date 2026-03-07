import { renderHook, act } from "@testing-library/react-native";

// Mock WebSocket
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];
  readyState: number = 0; // CONNECTING

  static OPEN = 1;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Helper to simulate a successful open
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  static instances: MockWebSocket[] = [];
  static clear() {
    MockWebSocket.instances = [];
  }
}

(global as any).WebSocket = MockWebSocket;

// Must import after WebSocket mock
import { useGroupSocket } from "../../hooks/useGroupSocket";

describe("useGroupSocket", () => {
  beforeEach(() => {
    MockWebSocket.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not connect when groupId is null", () => {
    const { unmount } = renderHook(() => useGroupSocket(null));
    expect(MockWebSocket.instances).toHaveLength(0);
    unmount();
  });

  it("connects when groupId is provided", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain("/ws");
    unmount();
  });

  it("sends join_group message on open", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });

    expect(ws.sentMessages).toHaveLength(1);
    expect(JSON.parse(ws.sentMessages[0])).toEqual({
      type: "join_group",
      groupId: "group-1",
    });
    unmount();
  });

  it("calls onMessage for deuce_logged events", () => {
    const onMessage = jest.fn();
    const { unmount } = renderHook(() => useGroupSocket("group-1", onMessage));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({
          type: "deuce_logged",
          message: "New log",
          entry: { id: "1" },
          userId: "u1",
        }),
      });
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: "deuce_logged",
      message: "New log",
      entry: { id: "1" },
      userId: "u1",
    });
    unmount();
  });

  it("ignores non-deuce_logged events", () => {
    const onMessage = jest.fn();
    const { unmount } = renderHook(() => useGroupSocket("group-1", onMessage));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({ type: "other_event", data: {} }),
      });
    });

    expect(onMessage).not.toHaveBeenCalled();
    unmount();
  });

  it("ignores malformed JSON messages", () => {
    const onMessage = jest.fn();
    const { unmount } = renderHook(() => useGroupSocket("group-1", onMessage));
    const ws = MockWebSocket.instances[0];

    expect(() => {
      act(() => {
        ws.onmessage?.({ data: "not-valid-json{{{" });
      });
    }).not.toThrow();

    expect(onMessage).not.toHaveBeenCalled();
    unmount();
  });

  it("closes WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    const ws = MockWebSocket.instances[0];
    const closeSpy = jest.spyOn(ws, "close");

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  // ─── Reconnection tests ──────────────────────────────────────

  it("reconnects with exponential backoff on close", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    const ws1 = MockWebSocket.instances[0];

    act(() => {
      ws1.simulateOpen();
    });

    // Simulate unexpected close
    act(() => {
      ws1.onclose?.();
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    // First retry: 1s (BASE_RECONNECT_MS * 2^0)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Close the second connection without opening (simulates failed connect)
    const ws2 = MockWebSocket.instances[1];
    act(() => {
      ws2.onclose?.();
    });

    // Second retry: 2s (BASE_RECONNECT_MS * 2^1)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2); // not yet

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(3);

    unmount();
  });

  it("resets retry count on successful connection", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    const ws1 = MockWebSocket.instances[0];

    act(() => {
      ws1.simulateOpen();
      ws1.onclose?.();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const ws2 = MockWebSocket.instances[1];
    // Successful open resets retry count
    act(() => {
      ws2.simulateOpen();
      ws2.onclose?.();
    });

    // Should use base delay (1s) since retries were reset
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(3);

    unmount();
  });

  it("does not reconnect on intentional close (unmount)", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    expect(MockWebSocket.instances).toHaveLength(1);

    unmount();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("returns connection state", () => {
    const { result, unmount } = renderHook(() => useGroupSocket("group-1"));

    expect(result.current.connectionState).toBe("connecting");

    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });
    expect(result.current.connectionState).toBe("connected");

    act(() => {
      ws.onclose?.();
    });
    expect(result.current.connectionState).toBe("disconnected");

    unmount();
  });

  // ─── Heartbeat tests ─────────────────────────────────────────

  it("sends ping after heartbeat interval", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });

    const msgCountAfterJoin = ws.sentMessages.length;

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    const newMessages = ws.sentMessages.slice(msgCountAfterJoin);
    expect(newMessages).toHaveLength(1);
    expect(JSON.parse(newMessages[0])).toEqual({ type: "ping" });

    unmount();
  });

  it("handles pong response and clears heartbeat timeout", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });

    // Trigger heartbeat ping
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    // Respond with pong
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: "pong" }) });
    });

    // Advance past heartbeat timeout - connection should stay open
    const closeSpy = jest.spyOn(ws, "close");
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(closeSpy).not.toHaveBeenCalled();

    unmount();
  });

  it("closes connection when no pong received within timeout", () => {
    const { unmount } = renderHook(() => useGroupSocket("group-1"));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
    });

    // Trigger heartbeat ping
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    const closeSpy = jest.spyOn(ws, "close");

    // Don't send pong, advance past timeout (10s)
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(closeSpy).toHaveBeenCalled();

    unmount();
  });

  it("does not fire onMessage for pong events", () => {
    const onMessage = jest.fn();
    const { unmount } = renderHook(() => useGroupSocket("group-1", onMessage));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: "pong" }) });
    });

    expect(onMessage).not.toHaveBeenCalled();
    unmount();
  });
});
