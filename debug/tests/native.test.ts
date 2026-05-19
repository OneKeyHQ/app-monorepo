import { describe, it, expect, vi, beforeEach } from "vitest";

// Reuse the frida mock so the FridaAdapter wired by Registry.attach() succeeds
// — we only need to verify the tool routing layer's error codes.
const mockExports = {
  call: vi.fn(async () => "result-x"),
  hook: vi.fn(async () => 7),
  unhook: vi.fn(async () => true),
  listHooks: vi.fn(async () => [{ id: 7, method: "-[X y]" }]),
  drainEvents: vi.fn(async () => []),
  runScript: vi.fn(async () => ({ ok: true, exports: [] })),
};
const mockScript = {
  load: vi.fn(async () => undefined),
  unload: vi.fn(async () => undefined),
  message: { connect: vi.fn() },
  exports: mockExports,
};
const mockSession = {
  createScript: vi.fn(async () => mockScript),
  detach: vi.fn(async () => undefined),
};
const mockDevice = {
  id: "test-device",
  type: "usb",
  enumerateApplications: vi.fn(async () => [
    { identifier: "com.onekey.wallet", pid: 999, name: "OneKey" },
  ]),
  attach: vi.fn(async () => mockSession),
};
vi.mock("frida", () => ({
  default: {
    getUsbDevice: vi.fn(async () => mockDevice),
    getDeviceManager: () => ({
      enumerateDevices: async () => [mockDevice],
    }),
  },
}));

describe("native.* tool routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nativeCall proxies through a connected FridaAdapter", async () => {
    const { Registry } = await import("../src/daemon/registry.js");
    const { nativeCall } = await import("../src/tools/native.js");
    const r = new Registry();
    const s = await r.attach({ platform: "ios", deviceId: "booted" });
    const res = await nativeCall(r, { sessionId: s.id, selector: "-[Foo bar]" });
    expect(res).toEqual({ result: "result-x" });
  });

  it("throws -32020 when frida adapter is absent", async () => {
    const { Registry } = await import("../src/daemon/registry.js");
    const { nativeCall } = await import("../src/tools/native.js");
    const r = new Registry();
    const s = await r.attach({ platform: "ios", deviceId: "booted" });
    // Remove the auto-wired adapter.
    r.get(s.id).adapters.delete("frida");
    await expect(
      nativeCall(r, { sessionId: s.id, selector: "-[Foo bar]" }),
    ).rejects.toMatchObject({ code: -32020 });
  });

  it("throws -32021 when frida adapter present but not connected", async () => {
    // Make the Frida attach path fail by returning zero apps.
    mockDevice.enumerateApplications.mockResolvedValueOnce([]);
    const { Registry } = await import("../src/daemon/registry.js");
    const { nativeCall } = await import("../src/tools/native.js");
    const r = new Registry();
    const s = await r.attach({ platform: "ios", deviceId: "booted" });
    await expect(
      nativeCall(r, { sessionId: s.id, selector: "-[Foo bar]" }),
    ).rejects.toMatchObject({ code: -32021 });
  });

  it("nativeHook + nativeUnhook + nativeListHooks round-trip", async () => {
    const { Registry } = await import("../src/daemon/registry.js");
    const { nativeHook, nativeUnhook, nativeListHooks } = await import(
      "../src/tools/native.js"
    );
    const r = new Registry();
    const s = await r.attach({ platform: "ios", deviceId: "booted" });
    expect(await nativeHook(r, { sessionId: s.id, method: "-[X y]" })).toEqual({
      hookId: 7,
    });
    expect(await nativeUnhook(r, { sessionId: s.id, hookId: 7 })).toEqual({
      removed: true,
    });
    expect(await nativeListHooks(r, { sessionId: s.id })).toEqual({
      hooks: [{ id: 7, method: "-[X y]" }],
    });
  });
});
