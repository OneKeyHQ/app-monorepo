import { describe, it, expect, vi, beforeEach } from "vitest";

// Two distinct mocked Frida devices: each has its own attach/exports so we
// can assert that a session's calls only reach the device whose id matches
// its deviceId. The deviceManager surfaces both, and the per-id matcher in
// FridaAdapter.attach() picks the right one.

const deviceAExports = {
  platform: vi.fn(async () => "ios"),
  call: vi.fn(async () => "from-A"),
  hook: vi.fn(async () => 1),
  unhook: vi.fn(async () => true),
  listHooks: vi.fn(async () => []),
  drainEvents: vi.fn(async () => []),
  runScript: vi.fn(async () => ({ ok: true, exports: [] })),
  memoryClasses: vi.fn(async () => []),
};

const deviceBExports = {
  platform: vi.fn(async () => "ios"),
  call: vi.fn(async () => "from-B"),
  hook: vi.fn(async () => 2),
  unhook: vi.fn(async () => true),
  listHooks: vi.fn(async () => []),
  drainEvents: vi.fn(async () => []),
  runScript: vi.fn(async () => ({ ok: true, exports: [] })),
  memoryClasses: vi.fn(async () => []),
};

const scriptA = {
  load: vi.fn(async () => undefined),
  unload: vi.fn(async () => undefined),
  message: { connect: vi.fn() },
  exports: deviceAExports,
};

const scriptB = {
  load: vi.fn(async () => undefined),
  unload: vi.fn(async () => undefined),
  message: { connect: vi.fn() },
  exports: deviceBExports,
};

const sessionA = {
  createScript: vi.fn(async () => scriptA),
  detach: vi.fn(async () => undefined),
};

const sessionB = {
  createScript: vi.fn(async () => scriptB),
  detach: vi.fn(async () => undefined),
};

const deviceA = {
  id: "device-A",
  type: "usb",
  enumerateApplications: vi.fn(async () => [
    { identifier: "com.onekey.wallet", pid: 100, name: "OneKey" },
  ]),
  attach: vi.fn(async () => sessionA),
};

const deviceB = {
  id: "device-B",
  type: "usb",
  enumerateApplications: vi.fn(async () => [
    { identifier: "com.onekey.wallet", pid: 200, name: "OneKey" },
  ]),
  attach: vi.fn(async () => sessionB),
};

vi.mock("frida", () => ({
  default: {
    // Fallback for code paths that bypass per-id selection (kept on deviceA
    // so legacy single-device behavior remains predictable).
    getUsbDevice: vi.fn(async () => deviceA),
    getDeviceManager: () => ({
      enumerateDevices: async () => [deviceA, deviceB],
    }),
  },
}));

describe("multi-device sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // beforeEach clears history but not implementations — restore the happy
    // path return values so each test starts with both devices reachable.
    deviceA.enumerateApplications.mockResolvedValue([
      { identifier: "com.onekey.wallet", pid: 100, name: "OneKey" },
    ]);
    deviceB.enumerateApplications.mockResolvedValue([
      { identifier: "com.onekey.wallet", pid: 200, name: "OneKey" },
    ]);
  });

  it("two sessions on different deviceIds attach to different Frida devices", async () => {
    const { Registry } = await import("../src/daemon/registry.js");
    const r = new Registry();
    const a = await r.attach({ platform: "ios", deviceId: "device-A" });
    const b = await r.attach({ platform: "ios", deviceId: "device-B" });
    expect(a.id).not.toBe(b.id);
    expect(deviceA.attach).toHaveBeenCalledWith(100);
    expect(deviceB.attach).toHaveBeenCalledWith(200);
    // Neither session should have crossed over to the other device.
    expect(deviceA.attach).not.toHaveBeenCalledWith(200);
    expect(deviceB.attach).not.toHaveBeenCalledWith(100);
  });

  it("native.call routes to the correct device per session", async () => {
    const { Registry } = await import("../src/daemon/registry.js");
    const { nativeCall } = await import("../src/tools/native.js");
    const r = new Registry();
    const a = await r.attach({ platform: "ios", deviceId: "device-A" });
    const b = await r.attach({ platform: "ios", deviceId: "device-B" });
    const resA = await nativeCall(r, {
      sessionId: a.id,
      selector: "-[Foo bar]",
    });
    const resB = await nativeCall(r, {
      sessionId: b.id,
      selector: "-[Foo bar]",
    });
    expect(resA.result).toBe("from-A");
    expect(resB.result).toBe("from-B");
    expect(deviceAExports.call).toHaveBeenCalledTimes(1);
    expect(deviceBExports.call).toHaveBeenCalledTimes(1);
  });

  it("detach is isolated per session — tearing down A leaves B intact", async () => {
    const { Registry } = await import("../src/daemon/registry.js");
    const { nativeCall } = await import("../src/tools/native.js");
    const r = new Registry();
    const a = await r.attach({ platform: "ios", deviceId: "device-A" });
    const b = await r.attach({ platform: "ios", deviceId: "device-B" });
    await r.detach({ sessionId: a.id });
    // B must still be callable
    const resB = await nativeCall(r, {
      sessionId: b.id,
      selector: "-[Bar baz]",
    });
    expect(resB.result).toBe("from-B");
    expect(sessionA.detach).toHaveBeenCalledTimes(1);
    expect(sessionB.detach).not.toHaveBeenCalled();
  });
});
