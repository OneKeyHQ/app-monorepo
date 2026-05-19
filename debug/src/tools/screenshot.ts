import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Adb } from "../adapters/androidNative.js";
import { SimCtl } from "../adapters/iosNative.js";
import type { Registry } from "../daemon/registry.js";

let dir = path.join(homedir(), ".onekey-debug", "screenshots");

/** Override the output directory (tests only). */
export function setScreenshotDir(p: string): void {
  dir = p;
}

export function getScreenshotDir(): string {
  return dir;
}

export interface ScreenshotResult {
  path: string;
  bytes: number;
}

export async function screenshot(
  registry: Registry,
  params: { sessionId: string },
): Promise<ScreenshotResult> {
  const s = registry.get(params.sessionId);
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, `${s.id}-${Date.now()}.png`);

  if (s.platform === "android") {
    const adb = new Adb(s.deviceId);
    const png = await adb.execOut(["screencap", "-p"]);
    if (png.length === 0) {
      throw new Error(
        "adb screencap returned empty buffer (is the device unlocked?)",
      );
    }
    await fs.writeFile(out, png);
  } else {
    const sim = new SimCtl(s.deviceId);
    await sim.screenshot(out);
  }

  const stat = await fs.stat(out);
  return { path: out, bytes: stat.size };
}
