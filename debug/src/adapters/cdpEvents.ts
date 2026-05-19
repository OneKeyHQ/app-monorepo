import type CDP from "chrome-remote-interface";

// Per-session ring buffers for CDP event streams. We subscribe once per CDP
// handle (immediately after attach) and accumulate console + network events
// into bounded buffers so later js.console.tail / js.network.list calls can
// answer without needing a live stream of their own.
//
// Bounds intentionally hard-coded:
//   - 500 console entries (oldest dropped FIFO)
//   - 500 network entries (oldest by startedAt dropped)
//   - Response bodies are fetched lazily via Network.getResponseBody and
//     cached per requestId (also evicted when the request is pruned).

const MAX_LOGS = 500;
const MAX_NET = 500;

export interface ConsoleEntry {
  ts: number;
  type: string; // "log" | "warn" | "error" | "info" | "debug" | etc.
  args: unknown[]; // serialized via returnByValue
  stackTrace?: unknown;
}

export interface NetworkEntry {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  mimeType?: string;
  startedAt: number;
  endedAt?: number;
  failedReason?: string;
  // body fetched lazily; not stored unless requested
}

interface SessionBuffers {
  console: ConsoleEntry[];
  network: Map<string, NetworkEntry>;
  bodies: Map<string, { body: string; base64Encoded: boolean }>;
  client: CDP.Client;
  detached: boolean;
}

const bySession = new Map<string, SessionBuffers>();

export function getBuffers(sessionId: string): SessionBuffers | undefined {
  return bySession.get(sessionId);
}

// chrome-remote-interface exposes per-event subscriptions as callable members
// on `client.<Domain>.<event>(cb)`. Hermes' inspector may not implement every
// Network event (or even the Network domain at all), so we treat all of these
// as optional and wrap calls in try/catch + optional-chaining.
interface CdpEventTarget {
  Runtime: {
    consoleAPICalled?: (cb: (params: unknown) => void) => void;
  };
  Network: {
    enable?: () => Promise<unknown>;
    requestWillBeSent?: (cb: (params: unknown) => void) => void;
    responseReceived?: (cb: (params: unknown) => void) => void;
    loadingFinished?: (cb: (params: unknown) => void) => void;
    loadingFailed?: (cb: (params: unknown) => void) => void;
    getResponseBody?: (p: {
      requestId: string;
    }) => Promise<{ body: string; base64Encoded: boolean }>;
  };
}

export async function attachEvents(
  sessionId: string,
  client: CDP.Client,
): Promise<void> {
  if (bySession.has(sessionId)) return;

  const buf: SessionBuffers = {
    console: [],
    network: new Map(),
    bodies: new Map(),
    client,
    detached: false,
  };
  bySession.set(sessionId, buf);

  // Narrowed to a structural interface — CRI's published types don't capture
  // the optional subscribe shape, and Hermes may simply not expose Network.
  const c = client as unknown as CdpEventTarget;

  // Runtime is already enabled by jsEval/attachHermes; enable Network here
  // for hosts that support it. Failures are non-fatal — Hermes degrades to
  // console-only.
  try {
    await c.Network.enable?.();
  } catch {
    // Network domain may not be available on Hermes — degrade gracefully.
  }

  c.Runtime.consoleAPICalled?.((params) => {
    if (buf.detached) return;
    const p = params as {
      type: string;
      args?: { value?: unknown }[];
      stackTrace?: unknown;
    };
    const entry: ConsoleEntry = {
      ts: Date.now(),
      type: p.type,
      args: (p.args ?? []).map((a) => a.value),
      stackTrace: p.stackTrace,
    };
    buf.console.push(entry);
    if (buf.console.length > MAX_LOGS) buf.console.shift();
  });

  c.Network.requestWillBeSent?.((params) => {
    if (buf.detached) return;
    const p = params as {
      requestId: string;
      request: { url: string; method: string };
      timestamp: number;
    };
    buf.network.set(p.requestId, {
      requestId: p.requestId,
      url: p.request.url,
      method: p.request.method,
      startedAt: Date.now(),
    });
    pruneNetwork(buf);
  });

  c.Network.responseReceived?.((params) => {
    if (buf.detached) return;
    const p = params as {
      requestId: string;
      response: { status: number; mimeType: string };
    };
    const e = buf.network.get(p.requestId);
    if (e) {
      e.status = p.response.status;
      e.mimeType = p.response.mimeType;
    }
  });

  c.Network.loadingFinished?.((params) => {
    if (buf.detached) return;
    const p = params as { requestId: string };
    const e = buf.network.get(p.requestId);
    if (e) e.endedAt = Date.now();
  });

  c.Network.loadingFailed?.((params) => {
    if (buf.detached) return;
    const p = params as { requestId: string; errorText: string };
    const e = buf.network.get(p.requestId);
    if (e) {
      e.endedAt = Date.now();
      e.failedReason = p.errorText;
    }
  });
}

export function detachEvents(sessionId: string): void {
  const buf = bySession.get(sessionId);
  if (!buf) return;
  buf.detached = true;
  buf.console.length = 0;
  buf.network.clear();
  buf.bodies.clear();
  bySession.delete(sessionId);
}

function pruneNetwork(buf: SessionBuffers): void {
  if (buf.network.size <= MAX_NET) return;
  const oldest = [...buf.network.entries()]
    .sort((a, b) => a[1].startedAt - b[1].startedAt)
    .slice(0, buf.network.size - MAX_NET);
  for (const [id] of oldest) {
    buf.network.delete(id);
    buf.bodies.delete(id);
  }
}

export async function fetchBody(
  sessionId: string,
  requestId: string,
): Promise<{ body: string; base64Encoded: boolean } | undefined> {
  const buf = bySession.get(sessionId);
  if (!buf) return undefined;
  const cached = buf.bodies.get(requestId);
  if (cached) return cached;
  try {
    const c = buf.client as unknown as CdpEventTarget;
    if (!c.Network.getResponseBody) return undefined;
    const r = await c.Network.getResponseBody({ requestId });
    buf.bodies.set(requestId, r);
    return r;
  } catch {
    return undefined;
  }
}
