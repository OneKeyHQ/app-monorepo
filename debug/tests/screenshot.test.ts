import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Registry } from "../src/daemon/registry.js";
import { setScreenshotDir, screenshot } from "../src/tools/screenshot.js";

// Mock execa: returns a fake PNG for android, writes a fake PNG for ios.
vi.mock("execa", () => ({
  execa: vi.fn(async (cmd: string, args: readonly string[]) => {
    if (cmd === "adb") {
      // android exec-out screencap -p
      return { stdout: Buffer.from("\x89PNG\r\n\x1a\nANDROID-FAKE-PIXELS") };
    }
    if (cmd === "xcrun") {
      // ios simctl io booted screenshot <outPath>
      const out = args[args.length - 1];
      await fs.writeFile(out, Buffer.from("\x89PNG\r\n\x1a\nIOS-FAKE-PIXELS"));
      return { stdout: Buffer.alloc(0) };
    }
    throw new Error(`unexpected cmd: ${cmd}`);
  }),
}));

let tempDir: string;
beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "ss-"));
  setScreenshotDir(tempDir);
});

describe("screenshot", () => {
  it("android writes PNG and returns path + bytes", async () => {
    const r = new Registry();
    const s = await r.attach({ platform: "android", deviceId: "emu-5554" });
    const out = await screenshot(r, { sessionId: s.id });
    expect(existsSync(out.path)).toBe(true);
    expect(out.bytes).toBeGreaterThan(0);
    expect(out.path).toMatch(new RegExp(`${s.id}-\\d+\\.png$`));
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("ios writes PNG via simctl", async () => {
    const r = new Registry();
    const s = await r.attach({ platform: "ios", deviceId: "booted" });
    const out = await screenshot(r, { sessionId: s.id });
    expect(existsSync(out.path)).toBe(true);
    expect(out.bytes).toBeGreaterThan(0);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws when android screencap returns empty buffer", async () => {
    const r = new Registry();
    const s = await r.attach({ platform: "android", deviceId: "emu-5554" });

    // Re-mock to return empty
    const { execa } = await import("execa");
    vi.mocked(execa).mockImplementationOnce(
      (async () => ({ stdout: Buffer.alloc(0) })) as never,
    );

    await expect(screenshot(r, { sessionId: s.id })).rejects.toThrow(
      /empty buffer/,
    );
    rmSync(tempDir, { recursive: true, force: true });
  });
});
