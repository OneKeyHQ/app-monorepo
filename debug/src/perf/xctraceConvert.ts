// xctrace XML → chrome trace JSON converter.
//
// Best-effort, schema-version-fragile. Apple does not publish a stable schema
// for the XML produced by `xcrun xctrace export --xpath //run-instrument`.
// We target a simplified shape (one <sample> per stack sample, plain
// <frame name="..."/> elements inside <backtrace>) that matches what recent
// Instruments builds emit for the Time Profile template. If a future xctrace
// version switches to the cross-referenced <row>/<sample-time>/<weight>
// schema, this converter will need updating.
//
// Output conforms to the Chrome Trace Event format (JSON Object Format), the
// "duration" (ph:"X") events plus "metadata" (ph:"M") events for process and
// thread names. Viewable in chrome://tracing and ui.perfetto.dev.

import { XMLParser } from "fast-xml-parser";

export interface ChromeTraceEvent {
  ph: "X";
  name: string;
  cat?: string;
  ts: number; // microseconds
  dur: number; // microseconds
  pid: number;
  tid: number;
  args?: Record<string, unknown>;
}

export interface ChromeTrace {
  traceEvents: ChromeTraceEvent[];
  displayTimeUnit: "ns" | "ms";
  metadata?: Record<string, unknown>;
}

interface ParsedFrame {
  name?: string;
  address?: string;
}

interface ParsedSample {
  startNs: number;
  durNs: number;
  tid: number;
  threadName?: string;
  frames: ParsedFrame[];
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function xmlToChromeTrace(xml: string): ChromeTrace {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Force these tag names to always be arrays so a single sample/frame
    // doesn't collapse into an object. fast-xml-parser otherwise returns
    // either `{tag: {...}}` or `{tag: [{...}, {...}]}` depending on count.
    isArray: (name) =>
      name === "sample" || name === "frame" || name === "process",
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;

  const result = parsed["trace-query-result"] as
    | Record<string, unknown>
    | undefined;
  const node = (result?.node ?? {}) as Record<string, unknown>;
  const runInst = (node["run-instrument"] ?? {}) as Record<string, unknown>;
  const target = (runInst.target ?? {}) as Record<string, unknown>;
  const procList = (target["process-list"] ?? {}) as Record<string, unknown>;
  const processes = asArray<Record<string, unknown>>(
    procList.process as Record<string, unknown> | undefined,
  );

  const pid = processes.length > 0 ? toNumber(processes[0]["@_pid"]) : 0;
  const procName =
    processes.length > 0
      ? String(processes[0]["@_name"] ?? "unknown")
      : "unknown";

  const samples = asArray<Record<string, unknown>>(
    runInst.sample as Record<string, unknown> | undefined,
  );
  const parsedSamples: ParsedSample[] = samples.map((s) => {
    const thread = (s.thread ?? {}) as Record<string, unknown>;
    const bt = (s.backtrace ?? {}) as Record<string, unknown>;
    const frames = asArray<Record<string, unknown>>(
      bt.frame as Record<string, unknown> | undefined,
    ).map((f) => ({
      name: f["@_name"] as string | undefined,
      address: f["@_address"] as string | undefined,
    }));
    return {
      startNs: toNumber(s["start-time"]),
      durNs: toNumber(s.duration),
      tid: toNumber(thread["@_tid"]),
      threadName: thread.name as string | undefined,
      frames,
    };
  });

  // Collect unique thread names so the viewer can label tracks by name
  // instead of by raw tid integer.
  const threadNames = new Map<number, string>();
  for (const s of parsedSamples) {
    if (s.threadName && !threadNames.has(s.tid)) {
      threadNames.set(s.tid, s.threadName);
    }
  }

  // process_name / thread_name use ph:"M" (metadata phase) but our strict
  // ChromeTraceEvent type only allows ph:"X". We build them as loose records
  // and cast on the final array — chrome://tracing accepts both phases in
  // the same array.
  const meta: Array<Record<string, unknown>> = [
    {
      ph: "M",
      pid,
      tid: 0,
      name: "process_name",
      args: { name: procName },
    },
  ];
  for (const [tid, name] of threadNames) {
    meta.push({
      ph: "M",
      pid,
      tid,
      name: "thread_name",
      args: { name },
    });
  }

  const traceEvents: ChromeTraceEvent[] = [];
  for (const s of parsedSamples) {
    const baseTsUs = Math.round(s.startNs / 1000);
    const durUs = Math.round(s.durNs / 1000);
    // Stacking strategy: each frame in the backtrace gets the same sample
    // window but each successive frame (deeper in the call stack) is offset
    // by +1µs and shortened by 1µs, so they render as visually nested
    // rectangles in chrome://tracing.
    for (let i = 0; i < s.frames.length; i++) {
      const f = s.frames[i];
      traceEvents.push({
        ph: "X",
        name: f.name ?? f.address ?? "<unknown>",
        cat: "sample",
        ts: baseTsUs + i,
        dur: Math.max(1, durUs - i),
        pid,
        tid: s.tid,
      });
    }
  }

  return {
    traceEvents: [...meta, ...traceEvents] as unknown as ChromeTraceEvent[],
    displayTimeUnit: "ns",
    metadata: {
      converter: "native-debug-bridge xctraceConvert",
      sourceFormat: "xctrace --xpath //run-instrument",
    },
  };
}
