import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseGfxinfoFps,
  parseMeminfoRssMb,
  parseProcStatusThreads,
  parseTopCpuPct,
} from "../src/perf/androidMetrics.js";
import { parseSimctlPs } from "../src/perf/iosMetrics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
function fx(name: string): string {
  return readFileSync(path.join(here, "fixtures", name), "utf8");
}

describe("perf parsers", () => {
  it("parses dumpsys meminfo TOTAL Rss", () => {
    const mb = parseMeminfoRssMb(fx("dumpsys_meminfo.txt"));
    expect(mb).toBeGreaterThan(100);
  });

  it("parses gfxinfo jank pct + 90th percentile → fps", () => {
    const { fps, jank_pct } = parseGfxinfoFps(fx("dumpsys_gfxinfo.txt"));
    expect(jank_pct).toBe(4.0);
    expect(fps).toBeGreaterThan(50);
  });

  it("parses /proc/<pid>/status Threads count", () => {
    expect(parseProcStatusThreads(fx("proc_status.txt"))).toBe(47);
  });

  it("parses adb top %CPU column", () => {
    expect(parseTopCpuPct(fx("adb_top.txt"))).toBeCloseTo(12.4, 1);
  });

  it("parses simctl ps cpu + rss", () => {
    const text = "  PID    %CPU    RSS\n12345   12.4   389120\n";
    const r = parseSimctlPs(text);
    expect(r.cpu_pct).toBeCloseTo(12.4, 1);
    expect(r.rss_mb).toBeGreaterThan(300);
  });

  it("returns null when meminfo TOTAL row is absent", () => {
    expect(parseMeminfoRssMb("no total here\n")).toBeNull();
  });

  it("returns null fps + jank when gfxinfo lacks the expected lines", () => {
    const r = parseGfxinfoFps("Graphics info\n");
    expect(r.fps).toBeNull();
    expect(r.jank_pct).toBeNull();
  });

  it("returns null when /proc/<pid>/status has no Threads line", () => {
    expect(parseProcStatusThreads("Name:\tfoo\n")).toBeNull();
  });
});
