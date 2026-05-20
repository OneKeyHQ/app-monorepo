import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { xmlToChromeTrace } from "../src/perf/xctraceConvert.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(
  path.join(here, "fixtures", "xctrace_sample.xml"),
  "utf8",
);

describe("xctrace → chrome trace converter", () => {
  it("emits process metadata first", () => {
    const t = xmlToChromeTrace(xml);
    // first event is process_name metadata
    expect((t.traceEvents[0] as unknown as { name: string }).name).toBe(
      "process_name",
    );
    expect(
      (t.traceEvents[0] as unknown as { args: { name: string } }).args.name,
    ).toBe("OneKey");
  });

  it("emits one thread_name metadata per unique tid", () => {
    const t = xmlToChromeTrace(xml);
    const tNames = t.traceEvents.filter(
      (e) => (e as unknown as { name: string }).name === "thread_name",
    );
    expect(tNames.length).toBe(2); // main-thread + JavaScript
  });

  it("expands each sample into one X event per stack frame", () => {
    const t = xmlToChromeTrace(xml);
    // 3 samples × (4 + 2 + 2) frames = 8 X events, plus 1 process + 2 thread = 3 meta = 11 total
    const xs = t.traceEvents.filter(
      (e) => (e as unknown as { ph: string }).ph === "X",
    );
    expect(xs.length).toBe(8);
  });

  it("converts ns → µs in ts and dur", () => {
    const t = xmlToChromeTrace(xml);
    // First X event: sample start 1000000000ns → 1000000µs, frame index 0
    const firstX = t.traceEvents.find(
      (e) => (e as unknown as { ph: string }).ph === "X",
    ) as unknown as { ts: number; dur: number };
    expect(firstX.ts).toBe(1000000); // 1e9 ns = 1e6 µs
    expect(firstX.dur).toBeGreaterThan(0);
  });

  it("preserves frame order (innermost last)", () => {
    const t = xmlToChromeTrace(xml);
    const xs = t.traceEvents
      .filter((e) => (e as unknown as { ph: string; ts: number }).ph === "X")
      .slice(0, 4);
    const names = xs.map((e) => (e as unknown as { name: string }).name);
    expect(names).toEqual([
      "main",
      "UIApplicationMain",
      "-[UIApplication _run]",
      "-[UIView layoutSubviews]",
    ]);
  });

  it("yields valid chrome trace JSON (parseable)", () => {
    const t = xmlToChromeTrace(xml);
    const json = JSON.stringify(t);
    const round = JSON.parse(json) as { traceEvents: unknown[] };
    expect(Array.isArray(round.traceEvents)).toBe(true);
    expect(round.traceEvents.length).toBeGreaterThan(0);
  });

  it("handles a sample with empty backtrace gracefully", () => {
    const empty = `<?xml version="1.0"?><trace-query-result><node><run-instrument name="Time Profile">
<target><process-list><process pid="1" name="X"/></process-list></target>
<sample><start-time>0</start-time><duration>1000</duration><thread tid="1"><name>main</name></thread><backtrace></backtrace></sample>
</run-instrument></node></trace-query-result>`;
    const t = xmlToChromeTrace(empty);
    // Process + thread meta, no X events
    const xs = t.traceEvents.filter(
      (e) => (e as unknown as { ph: string }).ph === "X",
    );
    expect(xs.length).toBe(0);
  });
});
