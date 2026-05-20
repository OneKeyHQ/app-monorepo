import { mkdtempSync, promises as fs, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bestAvailableCodec } from "../src/record/codec.js";
import {
  appendEvent,
  createOdbDir,
  finalize,
  readAllEvents,
  readManifest,
  type OdbManifest,
} from "../src/record/format.js";
import { replay, timeline } from "../src/record/player.js";

// Mock jsEval used by replay so we can verify it gets called per event without
// needing a real CDP/Hermes target.
vi.mock("../src/tools/jsEval.js", () => ({
  jsEval: vi.fn(async () => ({ value: 1, type: "number" })),
}));

// Mock the `frida` module so Registry.attach() can wire a "connected"
// FridaAdapter we can verify replay --apply forwards calls to.
const mockFridaCall = vi.fn(async () => "native-result");
const mockFridaExports = {
  platform: vi.fn(async () => "ios"),
  call: mockFridaCall,
  hook: vi.fn(async () => 1),
  unhook: vi.fn(async () => true),
  listHooks: vi.fn(async () => []),
  drainEvents: vi.fn(async () => []),
  runScript: vi.fn(async () => ({ ok: true, exports: [] })),
  memoryClasses: vi.fn(async () => []),
};
vi.mock("frida", () => ({
  default: {
    getUsbDevice: vi.fn(async () => ({
      id: "test-device",
      type: "usb",
      enumerateApplications: async () => [
        { identifier: "com.onekey.wallet", pid: 1, name: "OneKey" },
      ],
      attach: async () => ({
        createScript: async () => ({
          load: async () => undefined,
          unload: async () => undefined,
          message: { connect: () => undefined },
          exports: mockFridaExports,
        }),
        detach: async () => undefined,
      }),
    })),
    getDeviceManager: () => ({
      enumerateDevices: async () => [],
    }),
  },
}));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "odb-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("OdbFormat", () => {
  it("creates manifest + empty events file + media dir", async () => {
    const out = path.join(dir, "rec.odb");
    const manifest: OdbManifest = {
      version: 1,
      recordId: "R-1",
      sessionId: "S-x",
      platform: "ios",
      appBundle: "com.onekey.wallet",
      layers: ["js"],
      startedAt: 0,
      endedAt: null,
      eventCount: 0,
      compression: "none",
    };
    await createOdbDir(out, manifest);
    const m = await readManifest(out);
    expect(m.recordId).toBe("R-1");
    expect(await readAllEvents(out)).toEqual([]);
    const stat = await fs.stat(path.join(out, "media"));
    expect(stat.isDirectory()).toBe(true);
  });

  it("appendEvent + readAllEvents preserves order", async () => {
    const out = path.join(dir, "rec.odb");
    const manifest: OdbManifest = {
      version: 1,
      recordId: "R-2",
      sessionId: "S-y",
      platform: "android",
      appBundle: "com.onekey.wallet",
      layers: ["js"],
      startedAt: 1000,
      endedAt: null,
      eventCount: 0,
      compression: "none",
    };
    await createOdbDir(out, manifest);
    await appendEvent(out, {
      ts: 1100,
      layer: "js",
      kind: "console",
      type: "log",
      args: [1],
    });
    await appendEvent(out, {
      ts: 1200,
      layer: "js",
      kind: "eval",
      expression: "1+1",
    });
    const evs = await readAllEvents(out);
    expect(evs.map((e) => e.ts)).toEqual([1100, 1200]);
  });
});

describe("timeline", () => {
  it("returns events within the ±windowMs/2 band around startedAt + t", async () => {
    const out = path.join(dir, "rec.odb");
    const manifest: OdbManifest = {
      version: 1,
      recordId: "R-3",
      sessionId: "S-z",
      platform: "ios",
      appBundle: "x",
      layers: ["js"],
      startedAt: 1000,
      endedAt: 5000,
      eventCount: 3,
      compression: "none",
    };
    await createOdbDir(out, manifest);
    await appendEvent(out, {
      ts: 1100,
      layer: "js",
      kind: "console",
      type: "log",
      args: [],
    });
    await appendEvent(out, {
      ts: 3000,
      layer: "js",
      kind: "console",
      type: "log",
      args: [],
    });
    await appendEvent(out, {
      ts: 4500,
      layer: "js",
      kind: "console",
      type: "log",
      args: [],
    });

    // t=2000 → absStart=3000; windowMs=2000 → half=1000; band [2000..4000].
    // 1100 is outside, 3000 is inside, 4500 is outside.
    const r = await timeline({ path: out, t: 2000, windowMs: 2000 });
    expect(r.events.map((e) => e.ts)).toEqual([3000]);

    // Widening to windowMs=8000 (band [-1000..7000]) catches all three.
    const wide = await timeline({ path: out, t: 2000, windowMs: 8000 });
    expect(wide.events.length).toBe(3);
  });
});

describe("replay", () => {
  it("re-executes js eval events on a target session via jsEval mock", async () => {
    const { jsEval } = await import("../src/tools/jsEval.js");
    const out = path.join(dir, "rec.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-4",
      sessionId: "S-q",
      platform: "ios",
      appBundle: "x",
      layers: ["js"],
      startedAt: 0,
      endedAt: 100,
      eventCount: 2,
      compression: "none",
    };
    await createOdbDir(out, m);
    await appendEvent(out, {
      ts: 0,
      layer: "js",
      kind: "eval",
      expression: "1+1",
    });
    await appendEvent(out, {
      ts: 10,
      layer: "js",
      kind: "eval",
      expression: "2+2",
    });

    // Registry is unused by jsEval here (mocked) — pass a stub.
    const r = await replay({} as never, {
      path: out,
      targetSessionId: "S-target",
      speed: 1000,
    });
    expect(r.replayed).toBe(2);
    expect(jsEval).toHaveBeenCalledTimes(2);
  });

  it("filters by layer", async () => {
    const out = path.join(dir, "rec.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-5",
      sessionId: "S-q",
      platform: "ios",
      appBundle: "x",
      layers: ["js", "native"],
      startedAt: 0,
      endedAt: 50,
      eventCount: 2,
      compression: "none",
    };
    await createOdbDir(out, m);
    await appendEvent(out, {
      ts: 0,
      layer: "native",
      kind: "enter",
      hookId: 1,
      method: "-[X y]",
    });
    await appendEvent(out, {
      ts: 5,
      layer: "js",
      kind: "eval",
      expression: "1",
    });

    const r = await replay({} as never, {
      path: out,
      targetSessionId: "S-target",
      layers: ["js"],
      speed: 1000,
    });
    expect(r.replayed).toBe(1);
    expect(r.skipped).toBe(1);
  });

  it("returns zero counts for an empty recording", async () => {
    const out = path.join(dir, "rec.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-6",
      sessionId: "S-q",
      platform: "ios",
      appBundle: "x",
      layers: ["js"],
      startedAt: 0,
      endedAt: 0,
      eventCount: 0,
      compression: "none",
    };
    await createOdbDir(out, m);
    const r = await replay({} as never, {
      path: out,
      targetSessionId: "S-target",
      speed: 1000,
    });
    expect(r).toEqual({ replayed: 0, skipped: 0, errors: 0 });
  });

  it("counts errors when jsEval rejects", async () => {
    const { jsEval } = await import("../src/tools/jsEval.js");
    (jsEval as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom"),
    );
    const out = path.join(dir, "rec.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-7",
      sessionId: "S-q",
      platform: "ios",
      appBundle: "x",
      layers: ["js"],
      startedAt: 0,
      endedAt: 0,
      eventCount: 1,
      compression: "none",
    };
    await createOdbDir(out, m);
    await appendEvent(out, {
      ts: 0,
      layer: "js",
      kind: "eval",
      expression: "throwSomething()",
    });

    const r = await replay({} as never, {
      path: out,
      targetSessionId: "S-target",
      speed: 1000,
    });
    expect(r.errors).toBe(1);
    expect(r.replayed).toBe(0);
  });
});

describe("record with zstd codec (if available)", () => {
  it("writes events.ndjson.zst when codec is zstd", async () => {
    const codec = await bestAvailableCodec();
    if (codec !== "zstd") return; // skip if codec unavailable

    const out = path.join(dir, "rec.zstd.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-zz",
      sessionId: "S-z",
      platform: "ios",
      appBundle: "x",
      layers: ["js"],
      startedAt: 0,
      endedAt: null,
      eventCount: 0,
      compression: "zstd",
    };
    await createOdbDir(out, m);
    for (let i = 0; i < 250; i++) {
      await appendEvent(out, {
        ts: i,
        layer: "js",
        kind: "console",
        type: "log",
        args: [i],
      });
    }
    m.endedAt = 1000;
    m.eventCount = 250;
    await finalize(out, m);

    const evs = await readAllEvents(out);
    expect(evs.length).toBe(250);
    expect((evs[249] as { ts: number }).ts).toBe(249);

    // .zst file actually exists and the plain NDJSON does not.
    const zstStat = await fs.stat(path.join(out, "events.ndjson.zst"));
    expect(zstStat.size).toBeGreaterThan(0);
    await expect(fs.stat(path.join(out, "events.ndjson"))).rejects.toThrow();

    // Manifest round-trips its compression="zstd" field.
    const persisted = await readManifest(out);
    expect(persisted.compression).toBe("zstd");
  });

  it("reads legacy compression=none recordings even with zstd available", async () => {
    // Forward-compat / backward-compat guard: a recording written by an older
    // version (plain NDJSON, compression="none") must still read cleanly when
    // the newer reader is available.
    const out = path.join(dir, "rec.legacy.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-legacy",
      sessionId: "S-l",
      platform: "ios",
      appBundle: "x",
      layers: ["js"],
      startedAt: 0,
      endedAt: 100,
      eventCount: 2,
      compression: "none",
    };
    await createOdbDir(out, m);
    await appendEvent(out, {
      ts: 1,
      layer: "js",
      kind: "console",
      type: "log",
      args: ["a"],
    });
    await appendEvent(out, {
      ts: 2,
      layer: "js",
      kind: "console",
      type: "log",
      args: ["b"],
    });
    await finalize(out, m);

    const evs = await readAllEvents(out);
    expect(evs.length).toBe(2);
    // No .zst file should have been written.
    await expect(
      fs.stat(path.join(out, "events.ndjson.zst")),
    ).rejects.toThrow();
  });
});

describe("replay native layer", () => {
  beforeEach(() => mockFridaCall.mockClear());

  it("dry-run does not call into Frida", async () => {
    const out = path.join(dir, "rec-native.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-n",
      sessionId: "S-x",
      platform: "ios",
      appBundle: "x",
      layers: ["native"],
      startedAt: 0,
      endedAt: 100,
      eventCount: 1,
      compression: "none",
    };
    await createOdbDir(out, m);
    await appendEvent(out, {
      ts: 0,
      layer: "native",
      kind: "call",
      selector: "-[Foo bar]",
      args: [],
    });
    await finalize(out, m);

    const { replay } = await import("../src/record/player.js");
    const r = await replay({} as never, {
      path: out,
      targetSessionId: "S-target",
      layers: ["native"],
      speed: 1000,
      // no apply — dry-run
    });
    expect(r.replayed).toBe(0);
    expect(r.skipped).toBeGreaterThanOrEqual(1);
    expect(mockFridaCall).not.toHaveBeenCalled();
  });

  it("apply without confirmToken throws", async () => {
    const out = path.join(dir, "rec-native-2.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-n2",
      sessionId: "S-x",
      platform: "ios",
      appBundle: "x",
      layers: ["native"],
      startedAt: 0,
      endedAt: 100,
      eventCount: 1,
      compression: "none",
    };
    await createOdbDir(out, m);
    await appendEvent(out, {
      ts: 0,
      layer: "native",
      kind: "call",
      selector: "-[X y]",
      args: [],
    });
    await finalize(out, m);

    const { replay } = await import("../src/record/player.js");
    await expect(
      replay({} as never, {
        path: out,
        targetSessionId: "S-target",
        layers: ["native"],
        apply: true,
        speed: 1000,
      }),
    ).rejects.toThrow(/confirmToken=rct-/);
  });

  it("apply with matching confirmToken executes via FridaAdapter", async () => {
    const out = path.join(dir, "rec-native-3.odb");
    const m: OdbManifest = {
      version: 1,
      recordId: "R-n3",
      sessionId: "S-x",
      platform: "ios",
      appBundle: "x",
      layers: ["native"],
      startedAt: 0,
      endedAt: 100,
      eventCount: 1,
      compression: "none",
    };
    await createOdbDir(out, m);
    await appendEvent(out, {
      ts: 0,
      layer: "native",
      kind: "call",
      selector: "-[Foo bar]",
      args: [42],
    });
    await finalize(out, m);

    const { replay, replayConfirmToken } = await import(
      "../src/record/player.js"
    );
    const { Registry } = await import("../src/daemon/registry.js");
    const reg = new Registry();
    const s = await reg.attach({ platform: "ios", deviceId: "booted" });

    const token = replayConfirmToken({
      path: out,
      targetSessionId: s.id,
      layers: ["native"],
    });
    // Token is deterministic — same inputs yield the same token.
    expect(token).toMatch(/^rct-[0-9a-f]{16}$/);
    expect(
      replayConfirmToken({
        path: out,
        targetSessionId: s.id,
        layers: ["native"],
      }),
    ).toBe(token);

    const r = await replay(reg, {
      path: out,
      targetSessionId: s.id,
      layers: ["native"],
      apply: true,
      confirmToken: token,
      speed: 1000,
    });
    expect(r.replayed).toBe(1);
    expect(mockFridaCall).toHaveBeenCalledWith("-[Foo bar]", [42]);
  });
});
