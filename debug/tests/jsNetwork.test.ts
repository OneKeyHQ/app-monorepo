import { beforeEach, describe, expect, it } from "vitest";
import {
  attachEvents,
  detachEvents,
} from "../src/adapters/cdpEvents.js";
import { Registry } from "../src/daemon/registry.js";
import { networkBody, networkList } from "../src/tools/jsNetwork.js";

interface Callbacks {
  console?: (p: unknown) => void;
  reqWillBeSent?: (p: unknown) => void;
  respReceived?: (p: unknown) => void;
  loadingFinished?: (p: unknown) => void;
  loadingFailed?: (p: unknown) => void;
}

type AttachClient = Parameters<typeof attachEvents>[1];

let registry: Registry;
let sid: string;

beforeEach(async () => {
  registry = new Registry();
  const s = await registry.attach({ platform: "ios", deviceId: "booted" });
  sid = s.id;
  detachEvents(sid);
  const cbs: Callbacks = {};
  const client = {
    Runtime: {
      consoleAPICalled: (cb: (p: unknown) => void) => {
        cbs.console = cb;
      },
    },
    Network: {
      enable: async () => {},
      requestWillBeSent: (cb: (p: unknown) => void) => {
        cbs.reqWillBeSent = cb;
      },
      responseReceived: (cb: (p: unknown) => void) => {
        cbs.respReceived = cb;
      },
      loadingFinished: (cb: (p: unknown) => void) => {
        cbs.loadingFinished = cb;
      },
      loadingFailed: (cb: (p: unknown) => void) => {
        cbs.loadingFailed = cb;
      },
      getResponseBody: async () => ({ body: "Z", base64Encoded: false }),
    },
  };
  await attachEvents(sid, client as unknown as AttachClient);
  // Synthesize a couple of network requests so list/body have data.
  cbs.reqWillBeSent!({
    requestId: "A",
    request: { url: "https://a", method: "GET" },
    timestamp: 0,
  });
  cbs.reqWillBeSent!({
    requestId: "B",
    request: { url: "https://b", method: "POST" },
    timestamp: 1,
  });
});

describe("js.network.* tools", () => {
  it("list returns active requests", () => {
    const r = networkList(registry, { sessionId: sid });
    expect(r.entries.map((e) => e.requestId).sort()).toEqual(["A", "B"]);
  });

  it("respects limit by trimming oldest entries", () => {
    const r = networkList(registry, { sessionId: sid, limit: 1 });
    expect(r.entries.length).toBe(1);
    // slice(-limit) keeps the most recent.
    expect(r.entries[0].requestId).toBe("B");
  });

  it("body returns string", async () => {
    const r = await networkBody(registry, {
      sessionId: sid,
      requestId: "A",
    });
    expect(r.body).toBe("Z");
  });

  it("throws when session is unknown to the registry", () => {
    const r2 = new Registry();
    expect(() =>
      networkList(r2, { sessionId: "S-nope" }),
    ).toThrow(/session not found/);
  });

  it("throws when CDP not attached for an existing session", async () => {
    const reg = new Registry();
    const fresh = await reg.attach({ platform: "ios", deviceId: "booted" });
    expect(() => networkList(reg, { sessionId: fresh.id })).toThrow(
      /no CDP attached/,
    );
  });
});
