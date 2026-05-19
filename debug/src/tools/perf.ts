import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { execa, type ResultPromise } from "execa";
import { Adb } from "../adapters/androidNative.js";
import type { Registry } from "../daemon/registry.js";
import { snapshotAndroid } from "../perf/androidMetrics.js";
import { snapshotIos } from "../perf/iosMetrics.js";
import type { FpsSample, PerfSnapshot } from "../perf/types.js";

interface ActiveTrace {
  kind: "xctrace" | "perfetto";
  // execa returns a Promise-like child. We don't need full subprocess control
  // beyond awaiting completion + best-effort kill on stop.
  proc: ResultPromise<{ reject: false }>;
  outPath: string;
  startTs: number;
}

// Per-session map. Sessions are short-lived; we clear on stop and don't
// retain handles beyond a single trace window.
const activeTrace = new Map<string, ActiveTrace>();

const TRACE_DIR = path.join(homedir(), ".onekey-debug", "traces");

export async function perfMetrics(
  registry: Registry,
  params: { sessionId: string },
): Promise<PerfSnapshot> {
  const s = registry.get(params.sessionId);
  if (s.platform === "android") {
    return snapshotAndroid(new Adb(s.deviceId), s.id, s.appBundle);
  }
  return snapshotIos(s.id, s.deviceId, s.appBundle);
}

export async function perfFpsTail(
  registry: Registry,
  params: { sessionId: string; durationSeconds?: number; sampleHz?: number },
): Promise<{ samples: FpsSample[] }> {
  const seconds = params.durationSeconds ?? 5;
  const hz = params.sampleHz ?? 2;
  const samples: FpsSample[] = [];
  const intervalMs = 1000 / hz;
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const snap = await perfMetrics(registry, { sessionId: params.sessionId });
    samples.push({ ts: snap.ts, fps: snap.fps ?? 0 });
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { samples };
}

export async function perfMemoryClasses(
  registry: Registry,
  params: { sessionId: string; top?: number },
): Promise<{ classes: Array<{ name: string; rss_kb: number }> }> {
  const s = registry.get(params.sessionId);
  const top = params.top ?? 20;
  if (s.platform !== "android") {
    // V2: iOS via Frida ObjC class enum. MVP returns an empty list so
    // callers can still rely on a stable shape.
    return { classes: [] };
  }
  const adb = new Adb(s.deviceId);
  const r = await adb
    .shell(["dumpsys", "meminfo", s.appBundle, "-d"])
    .catch(() => "");
  const lines = r.split("\n");
  // Heuristic: pick rows like "  Native Heap   45123  ..." — first column is
  // a free-form class/category label, second column is the Pss in KB.
  const classes: Array<{ name: string; rss_kb: number }> = [];
  for (const ln of lines) {
    const m = /^\s{2,}([A-Za-z][\w\s-]+?)\s+(\d+)\s+\d+\s+/.exec(ln);
    if (!m) continue;
    classes.push({ name: m[1].trim(), rss_kb: Number(m[2]) });
  }
  classes.sort((a, b) => b.rss_kb - a.rss_kb);
  return { classes: classes.slice(0, top) };
}

export async function perfTraceStart(
  registry: Registry,
  params: {
    sessionId: string;
    kind?: "xctrace" | "perfetto";
    durationSeconds?: number;
  },
): Promise<{ traceId: string }> {
  const s = registry.get(params.sessionId);
  const ts = Date.now();
  const id = `T-${ts}`;
  await fs.mkdir(TRACE_DIR, { recursive: true });

  if (s.platform === "ios") {
    const out = path.join(TRACE_DIR, `${id}.trace`);
    const proc = execa(
      "xcrun",
      [
        "xctrace",
        "record",
        "--template",
        "Time Profile",
        "--attach",
        s.appBundle,
        "--time-limit",
        `${params.durationSeconds ?? 10}s`,
        "--output",
        out,
      ],
      { reject: false },
    );
    activeTrace.set(s.id, { kind: "xctrace", proc, outPath: out, startTs: ts });
    return { traceId: id };
  }

  // Android: write a minimal perfetto config via stdin and pull the trace
  // back to the host. We shell out to bash to keep the heredoc readable.
  const out = path.join(TRACE_DIR, `${id}.perfetto-trace`);
  const cfg = `
buffers { size_kb: 64000 fill_policy: DISCARD }
data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true } } }
data_sources { config { name: "linux.ftrace" ftrace_config { ftrace_events: "sched_switch" ftrace_events: "sched_process_exit" } } }
duration_ms: ${(params.durationSeconds ?? 10) * 1000}
`;
  const script = `
adb -s ${s.deviceId} shell perfetto -c - -o /data/misc/perfetto-traces/${id}.trace --txt <<'EOF'
${cfg}
EOF
adb -s ${s.deviceId} pull /data/misc/perfetto-traces/${id}.trace ${out}
`;
  const proc = execa("bash", ["-c", script], { reject: false });
  activeTrace.set(s.id, {
    kind: "perfetto",
    proc,
    outPath: out,
    startTs: ts,
  });
  return { traceId: id };
}

export async function perfTraceStop(
  registry: Registry,
  params: { sessionId: string; convertToChromeTrace?: boolean },
): Promise<{ path: string; converted?: string }> {
  // Verify session exists — throws -32004 if not.
  registry.get(params.sessionId);
  const t = activeTrace.get(params.sessionId);
  if (!t) {
    return { path: "" };
  }
  // Always delete first so a failure later doesn't leak the entry.
  activeTrace.delete(params.sessionId);
  try {
    // Both xctrace (--time-limit) and our perfetto bash wrapper exit on
    // their own once the window closes. Awaiting is enough.
    await t.proc.catch(() => undefined);
  } catch {
    // Ignore.
  }

  let converted: string | undefined;
  if (params.convertToChromeTrace) {
    if (t.kind === "xctrace") {
      const out = t.outPath.replace(/\.trace$/, "-chrome.json");
      try {
        const r = await execa(
          "xcrun",
          [
            "xctrace",
            "export",
            "--input",
            t.outPath,
            "--xpath",
            "//run-instrument",
          ],
          { reject: false },
        );
        // Dump the XML for now. A real xctrace → chrome trace converter is
        // a follow-up; the xctrace XML schema is non-trivial.
        await fs.writeFile(out, r.stdout || "");
        converted = out;
      } catch {
        // Best-effort.
      }
    }
    // perfetto: leave to host-side `traceconv` if installed (not invoked
    // here to keep MVP free of optional binaries).
  }
  return { path: t.outPath, ...(converted ? { converted } : {}) };
}

// Test-only helpers. The map is module-private; exporting these keeps the
// `activeTrace` reference encapsulated while letting tests/cleanup paths
// drain it.
export function _clearActiveTraces(): void {
  activeTrace.clear();
}
