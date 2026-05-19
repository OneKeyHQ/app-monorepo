import { beforeEach, describe, expect, it } from "vitest";
import {
  attachEvents,
  detachEvents,
  fetchBody,
  getBuffers,
} from "../src/adapters/cdpEvents.js";

// Minimal CDP-like shape: each domain method just stores its callback so the
// test can fire synthetic events. The real CRI client is structurally
// compatible — we cast to its expected type at the attachEvents call site.
interface Callbacks {
  console?: (p: unknown) => void;
  reqWillBeSent?: (p: unknown) => void;
  respReceived?: (p: unknown) => void;
  loadingFinished?: (p: unknown) => void;
  loadingFailed?: (p: unknown) => void;
}

interface FakeClient {
  Runtime: { consoleAPICalled: (cb: (p: unknown) => void) => void };
  Network: {
    enable: () => Promise<void>;
    requestWillBeSent?: (cb: (p: unknown) => void) => void;
    responseReceived?: (cb: (p: unknown) => void) => void;
    loadingFinished?: (cb: (p: unknown) => void) => void;
    loadingFailed?: (cb: (p: unknown) => void) => void;
    getResponseBody: (p: {
      requestId: string;
    }) => Promise<{ body: string; base64Encoded: boolean }>;
  };
}

function makeFakeClient(): { client: FakeClient; cbs: Callbacks } {
  const cbs: Callbacks = {};
  const client: FakeClient = {
    Runtime: {
      consoleAPICalled: (cb) => {
        cbs.console = cb;
      },
    },
    Network: {
      enable: async () => {},
      requestWillBeSent: (cb) => {
        cbs.reqWillBeSent = cb;
      },
      responseReceived: (cb) => {
        cbs.respReceived = cb;
      },
      loadingFinished: (cb) => {
        cbs.loadingFinished = cb;
      },
      loadingFailed: (cb) => {
        cbs.loadingFailed = cb;
      },
      getResponseBody: async ({ requestId }) => ({
        body: `body-for-${requestId}`,
        base64Encoded: false,
      }),
    },
  };
  return { client, cbs };
}

// Cast helper: bypass CRI's strict Client typing for the fake.
type AttachClient = Parameters<typeof attachEvents>[1];

const SID = "S-test001";

beforeEach(() => detachEvents(SID));

describe("cdpEvents", () => {
  it("captures console entries with ring-buffer cap", async () => {
    const { client, cbs } = makeFakeClient();
    await attachEvents(SID, client as unknown as AttachClient);
    for (let i = 0; i < 600; i++) {
      cbs.console!({ type: "log", args: [{ value: i }], stackTrace: undefined });
    }
    const buf = getBuffers(SID)!;
    expect(buf.console.length).toBe(500);
    expect((buf.console[0].args as number[])[0]).toBe(100);
    expect((buf.console.at(-1)!.args as number[])[0]).toBe(599);
  });

  it("tracks network request lifecycle", async () => {
    const { client, cbs } = makeFakeClient();
    await attachEvents(SID, client as unknown as AttachClient);
    cbs.reqWillBeSent!({
      requestId: "R1",
      request: { url: "https://x", method: "GET" },
      timestamp: 0,
    });
    cbs.respReceived!({
      requestId: "R1",
      response: { status: 200, mimeType: "application/json" },
    });
    cbs.loadingFinished!({ requestId: "R1" });
    const buf = getBuffers(SID)!;
    const e = buf.network.get("R1")!;
    expect(e.status).toBe(200);
    expect(e.mimeType).toBe("application/json");
    expect(e.endedAt).toBeGreaterThan(0);
  });

  it("captures load failures", async () => {
    const { client, cbs } = makeFakeClient();
    await attachEvents(SID, client as unknown as AttachClient);
    cbs.reqWillBeSent!({
      requestId: "R2",
      request: { url: "https://nope", method: "POST" },
      timestamp: 0,
    });
    cbs.loadingFailed!({ requestId: "R2", errorText: "net::ERR_FAILED" });
    const buf = getBuffers(SID)!;
    expect(buf.network.get("R2")!.failedReason).toBe("net::ERR_FAILED");
  });

  it("fetchBody caches and uses Network.getResponseBody", async () => {
    const { client } = makeFakeClient();
    await attachEvents(SID, client as unknown as AttachClient);
    const a = await fetchBody(SID, "R3");
    const b = await fetchBody(SID, "R3");
    expect(a?.body).toBe("body-for-R3");
    expect(b?.body).toBe(a?.body); // cached
  });

  it("detachEvents clears buffers and removes the session entry", async () => {
    const { client, cbs } = makeFakeClient();
    await attachEvents(SID, client as unknown as AttachClient);
    cbs.console!({ type: "log", args: [{ value: 1 }] });
    cbs.reqWillBeSent!({
      requestId: "R-z",
      request: { url: "https://z", method: "GET" },
      timestamp: 0,
    });
    expect(getBuffers(SID)).toBeDefined();
    detachEvents(SID);
    expect(getBuffers(SID)).toBeUndefined();
  });

  it("attachEvents is idempotent for the same sessionId", async () => {
    const { client, cbs } = makeFakeClient();
    await attachEvents(SID, client as unknown as AttachClient);
    cbs.console!({ type: "log", args: [{ value: "first" }] });
    // Second attach must NOT reset the buffer or rebind callbacks.
    const { client: client2 } = makeFakeClient();
    await attachEvents(SID, client2 as unknown as AttachClient);
    const buf = getBuffers(SID)!;
    expect(buf.console.length).toBe(1);
  });

  it("tolerates a CDP client missing Network domain methods", async () => {
    // Hermes degrades: no Network subscribers at all.
    const cbs: Callbacks = {};
    const degraded = {
      Runtime: {
        consoleAPICalled: (cb: (p: unknown) => void) => {
          cbs.console = cb;
        },
      },
      Network: {},
    };
    await attachEvents(SID, degraded as unknown as AttachClient);
    cbs.console!({ type: "warn", args: [{ value: "hi" }] });
    const buf = getBuffers(SID)!;
    expect(buf.console.length).toBe(1);
    expect(buf.console[0].type).toBe("warn");
    // No body available — fetchBody must return undefined, not throw.
    expect(await fetchBody(SID, "missing")).toBeUndefined();
  });
});
