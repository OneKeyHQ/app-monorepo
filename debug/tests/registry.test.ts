import { describe, it, expect } from "vitest";
import { Registry } from "../src/daemon/registry.js";

describe("Registry", () => {
  it("attaches and lists", async () => {
    const r = new Registry();
    const s = await r.attach({
      platform: "ios", deviceId: "booted", appBundle: "com.onekey.wallet",
    });
    expect(s.id).toMatch(/^S-[0-9a-f]{8}$/);
    expect(s.platform).toBe("ios");
    expect(r.list()).toEqual([s]);
  });

  it("uses default appBundle when omitted", async () => {
    const r = new Registry();
    const s = await r.attach({ platform: "ios", deviceId: "booted" });
    expect(s.appBundle).toBe("com.onekey.wallet");
  });

  it("rejects unknown platform with -32602", async () => {
    const r = new Registry();
    await expect(r.attach({ platform: "blackberry", deviceId: "x" })).rejects
      .toMatchObject({ code: -32602 });
  });

  it("throws -32004 on detach of unknown session", async () => {
    const r = new Registry();
    await expect(r.detach({ sessionId: "S-nope" })).rejects
      .toMatchObject({ code: -32004 });
  });

  it("status reports adapter health (frida always wired, best-effort)", async () => {
    const r = new Registry();
    const s = await r.attach({ platform: "android", deviceId: "emu-5554" });
    const st = await r.status({ sessionId: s.id });
    // FridaAdapter is wired into every session. It is best-effort: when no
    // device is reachable, `connected` is false and `detail` carries the
    // reason — but the adapter is always present so AI can introspect.
    expect(st.adapters).toHaveProperty("frida");
    expect(st.id).toBe(s.id);
  });

  it("detach removes the session from list", async () => {
    const r = new Registry();
    const s = await r.attach({ platform: "ios", deviceId: "booted" });
    const d = await r.detach({ sessionId: s.id });
    expect(d).toEqual({ detached: s.id });
    expect(r.list()).toEqual([]);
  });
});
