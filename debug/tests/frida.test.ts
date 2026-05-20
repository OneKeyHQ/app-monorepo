import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the `frida` module so tests never touch a real device or USB transport.
const mockExports = {
  platform: vi.fn(async () => "ios"),
  call: vi.fn(async () => "called-result"),
  hook: vi.fn(async () => 42),
  unhook: vi.fn(async () => true),
  listHooks: vi.fn(async () => [{ id: 42, method: "-[Foo bar]" }]),
  drainEvents: vi.fn(async () => []),
  runScript: vi.fn(async () => ({ ok: true, exports: [] })),
  memoryClasses: vi.fn(async (top: number) =>
    [
      { name: "ONEKeyWalletViewController", count: 12, rss_kb: 3 },
      { name: "RCTBridge", count: 4, rss_kb: 1 },
    ].slice(0, top),
  ),
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
    { identifier: "com.onekey.wallet", pid: 12345, name: "OneKey" },
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

describe("FridaAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default app enumeration to the happy-path value
    mockDevice.enumerateApplications.mockResolvedValue([
      { identifier: "com.onekey.wallet", pid: 12345, name: "OneKey" },
    ]);
  });

  it("attaches by pid and loads the agent script", async () => {
    const { FridaAdapter } = await import("../src/adapters/frida.js");
    const a = new FridaAdapter("ios", "booted", "com.onekey.wallet");
    await a.attach();
    const h = await a.health();
    expect(h.connected).toBe(true);
    expect(h.detail).toContain("pid=12345");
    expect(mockDevice.attach).toHaveBeenCalledWith(12345);
    expect(mockScript.load).toHaveBeenCalled();
  });

  it("surfaces missing app as health.detail (does not throw)", async () => {
    const { FridaAdapter } = await import("../src/adapters/frida.js");
    mockDevice.enumerateApplications.mockResolvedValueOnce([]);
    const a = new FridaAdapter("ios", "booted", "com.missing.app");
    await a.attach(); // must NOT throw
    const h = await a.health();
    expect(h.connected).toBe(false);
    expect(h.detail).toMatch(/not running/);
  });

  it("proxies call/hook/unhook/listHooks/runScript to rpc.exports", async () => {
    const { FridaAdapter } = await import("../src/adapters/frida.js");
    const a = new FridaAdapter("ios", "booted", "com.onekey.wallet");
    await a.attach();
    expect(await a.call("-[Foo bar]")).toBe("called-result");
    expect(await a.hook("-[Foo bar]")).toBe(42);
    expect(await a.unhook(42)).toBe(true);
    const hooks = await a.listHooks();
    expect(hooks[0]).toEqual({ id: 42, method: "-[Foo bar]" });
    expect(await a.runScript("exports.x = 1;")).toEqual({ ok: true, exports: [] });
  });

  it("isConnected gates raw exports access", async () => {
    const { FridaAdapter } = await import("../src/adapters/frida.js");
    const a = new FridaAdapter("ios", "booted", "com.onekey.wallet");
    // Before attach: not connected.
    expect(a.isConnected()).toBe(false);
    await expect(a.call("-[Foo bar]")).rejects.toThrow(/not attached/);
  });

  it("drainEvents returns and consumes the buffer slice", async () => {
    const { FridaAdapter } = await import("../src/adapters/frida.js");
    const a = new FridaAdapter("ios", "booted", "com.onekey.wallet");
    await a.attach();
    // Synthesize events through the `message` callback hooked in attach()
    const onMsg = mockScript.message.connect.mock.calls[0][0] as (m: unknown) => void;
    for (let i = 0; i < 5; i++) {
      onMsg({
        type: "send",
        payload: {
          kind: "event",
          evt: { id: 1, kind: "enter", method: "-[Foo bar]", ts: i },
        },
      });
    }
    const drained = a.drainEvents(3);
    expect(drained.length).toBe(3);
    expect(a.drainEvents(100).length).toBe(2);
  });

  it("memoryClasses proxies through rpc.exports", async () => {
    const { FridaAdapter } = await import("../src/adapters/frida.js");
    const a = new FridaAdapter("ios", "booted", "com.onekey.wallet");
    await a.attach();
    const classes = await a.memoryClasses(2);
    expect(classes.length).toBe(2);
    expect(classes[0]).toMatchObject({
      name: "ONEKeyWalletViewController",
      count: 12,
    });
    expect(mockExports.memoryClasses).toHaveBeenCalledWith(2);
  });

  it("detach unloads + clears state", async () => {
    const { FridaAdapter } = await import("../src/adapters/frida.js");
    const a = new FridaAdapter("ios", "booted", "com.onekey.wallet");
    await a.attach();
    await a.detach();
    expect(mockScript.unload).toHaveBeenCalled();
    expect(mockSession.detach).toHaveBeenCalled();
    expect(a.isConnected()).toBe(false);
  });
});
