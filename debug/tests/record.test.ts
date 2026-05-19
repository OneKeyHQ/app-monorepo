import { mkdtempSync, promises as fs, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendEvent,
  createOdbDir,
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
