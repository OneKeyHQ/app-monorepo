import { execa } from "execa";
import type { PerfSnapshot } from "./types.js";

// Match the first data row of `ps -o pid,%cpu,rss -p <pid>`: pid + cpu + rss.
const PS_RE = /^\s*\d+\s+([\d.]+)\s+(\d+)/m;

export function parseSimctlPs(
  text: string,
): { cpu_pct: number | null; rss_mb: number | null } {
  const m = PS_RE.exec(text);
  if (!m) return { cpu_pct: null, rss_mb: null };
  return {
    cpu_pct: Number(m[1]),
    // ps prints rss in KB on macOS.
    rss_mb: Math.round((Number(m[2]) / 1024) * 10) / 10,
  };
}

export async function snapshotIos(
  sessionId: string,
  udid: string,
  bundle: string,
): Promise<PerfSnapshot> {
  const ts = Date.now();
  const out: PerfSnapshot = {
    ts,
    session: sessionId,
    platform: "ios",
    cpu_pct: null,
    mem_rss_mb: null,
    mem_js_heap_mb: null,
    fps: null,
    jank_pct: null,
    thread_count: null,
  };

  try {
    // Discover pid for the bundle id inside the booted simulator. Sample
    // launchctl output line:
    //   12345     0   UIKitApplication:com.onekey.wallet[0x1234][1234]
    const r = await execa(
      "xcrun",
      ["simctl", "spawn", udid, "launchctl", "list"],
      { reject: false, timeout: 5_000 },
    );
    const line = r.stdout.split("\n").find((l) => l.includes(bundle));
    if (!line) return out;
    const pid = parseInt(line.trim().split(/\s+/)[0], 10);
    if (!Number.isFinite(pid)) return out;

    const ps = await execa(
      "xcrun",
      [
        "simctl",
        "spawn",
        udid,
        "ps",
        "-o",
        "pid,%cpu,rss",
        "-p",
        String(pid),
      ],
      { reject: false, timeout: 5_000 },
    );
    const parsed = parseSimctlPs(ps.stdout);
    out.cpu_pct = parsed.cpu_pct;
    out.mem_rss_mb = parsed.rss_mb;
  } catch {
    // Best-effort: leave null on failure.
  }

  return out;
}
