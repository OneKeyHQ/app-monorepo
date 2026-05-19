// Unified cross-platform performance schema. Every numeric field is
// nullable on purpose: a missing reading must be `null`, never 0, so
// downstream dashboards can distinguish "no data" from "actual zero".
export interface PerfSnapshot {
  ts: number;
  session: string;
  platform: "ios" | "android";
  cpu_pct: number | null;
  mem_rss_mb: number | null;
  mem_js_heap_mb: number | null;
  fps: number | null;
  jank_pct: number | null;
  thread_count: number | null;
}

export interface FpsSample {
  ts: number;
  fps: number;
}
