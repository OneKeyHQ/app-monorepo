import { Adb } from "../adapters/androidNative.js";
import type { PerfSnapshot } from "./types.js";

// Match the TOTAL row of `dumpsys meminfo <pkg>`. The columns are:
// Pss Total, Private Dirty, Private Clean, SwapPss Dirty, Rss Total, ...
// We capture the 5th numeric column = Rss Total (KB).
const RSS_RE = /^\s*TOTAL\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/m;
// Match the standard gfxinfo header lines.
const JANK_RE = /Janky frames: (\d+) \(([\d.]+)%\)/;
const TOTAL_FRAMES_RE = /Total frames rendered: (\d+)/;
const PCT90_RE = /90th percentile: (\d+)ms/;
const THREAD_RE = /^Threads:\s+(\d+)/m;
// Match a `top -b` row: pid + 7 fields + %CPU (1 decimal allowed).
const TOP_RE = /^\s*\d+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+([\d.]+)/m;

export function parseMeminfoRssMb(text: string): number | null {
  const m = RSS_RE.exec(text);
  if (!m) return null;
  // KB → MB, rounded to 0.1 MB.
  return Math.round((Number(m[1]) / 1024) * 10) / 10;
}

export function parseGfxinfoFps(
  text: string,
): { fps: number | null; jank_pct: number | null } {
  const j = JANK_RE.exec(text);
  const t = TOTAL_FRAMES_RE.exec(text);
  const p90 = PCT90_RE.exec(text);
  if (!t || !p90) return { fps: null, jank_pct: null };
  // Approximate FPS as 1000 / 90th-percentile-ms. Not a strict mean — it's
  // a stand-in until we have frame-by-frame stats from `framestats`.
  const fps = Math.round((1000 / Number(p90[1])) * 10) / 10;
  const jank_pct = j ? Number(j[2]) : null;
  return { fps, jank_pct };
}

export function parseProcStatusThreads(text: string): number | null {
  const m = THREAD_RE.exec(text);
  return m ? Number(m[1]) : null;
}

export function parseTopCpuPct(text: string): number | null {
  const m = TOP_RE.exec(text);
  return m ? Number(m[1]) : null;
}

export async function snapshotAndroid(
  adb: Adb,
  sessionId: string,
  pkg: string,
): Promise<PerfSnapshot> {
  const ts = Date.now();
  const out: PerfSnapshot = {
    ts,
    session: sessionId,
    platform: "android",
    cpu_pct: null,
    mem_rss_mb: null,
    mem_js_heap_mb: null,
    fps: null,
    jank_pct: null,
    thread_count: null,
  };

  try {
    const mem = await adb.shell(["dumpsys", "meminfo", pkg]);
    out.mem_rss_mb = parseMeminfoRssMb(mem);
  } catch {
    // Best-effort: leave null on failure.
  }

  try {
    // Reset first so the stats reflect the next ~500ms window.
    await adb
      .shell(["dumpsys", "gfxinfo", pkg, "reset"])
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 500));
    const gfx = await adb.shell(["dumpsys", "gfxinfo", pkg, "framestats"]);
    const fps = parseGfxinfoFps(gfx);
    out.fps = fps.fps;
    out.jank_pct = fps.jank_pct;
  } catch {
    // Best-effort.
  }

  try {
    // pidof returns "12345\n"; guard against empty output.
    const pidS = (await adb.shell(["pidof", pkg])).trim();
    const pid = parseInt(pidS, 10);
    if (Number.isFinite(pid)) {
      const status = await adb.shell(["cat", `/proc/${pid}/status`]);
      out.thread_count = parseProcStatusThreads(status);
      const top = await adb
        .shell(["top", "-n", "1", "-p", String(pid), "-b"])
        .catch(() => "");
      out.cpu_pct = parseTopCpuPct(top);
    }
  } catch {
    // Best-effort.
  }

  return out;
}
