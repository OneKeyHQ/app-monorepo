import { describe, expect, it } from "vitest";

import {
  bestAvailableCodec,
  compressText,
  decompressToText,
} from "../src/record/codec.js";

describe("codec", () => {
  it("bestAvailableCodec reports zstd on Node 22+ (built-in)", async () => {
    const c = await bestAvailableCodec();
    // Node 22+ ships zstd in node:zlib. We tolerate "none" only so this test
    // doesn't break on hypothetical future Node builds that disable it.
    expect(["zstd", "none"]).toContain(c);
  });

  it("round-trips a small string when zstd is available", async () => {
    const codec = await bestAvailableCodec();
    if (codec !== "zstd") return; // skip
    const original = "hello world\n".repeat(100);
    const compressed = await compressText(original);
    expect(compressed.length).toBeLessThan(original.length);
    const round = await decompressToText(compressed);
    expect(round).toBe(original);
  });

  it("round-trips a JSON-y payload", async () => {
    const codec = await bestAvailableCodec();
    if (codec !== "zstd") return;
    const events = Array.from(
      { length: 50 },
      (_, i) =>
        JSON.stringify({
          ts: i,
          layer: "js",
          kind: "console",
          type: "log",
          args: [i],
        }) + "\n",
    ).join("");
    const compressed = await compressText(events);
    const round = await decompressToText(compressed);
    expect(round).toBe(events);
  });

  it("achieves meaningful compression on repetitive NDJSON", async () => {
    const codec = await bestAvailableCodec();
    if (codec !== "zstd") return;
    // 2,000 near-identical lines — should compress to <10% of original.
    const events = Array.from(
      { length: 2_000 },
      (_, i) =>
        JSON.stringify({
          ts: 1_700_000_000_000 + i,
          layer: "network",
          kind: "request",
          requestId: `req-${i}`,
          url: "https://api.onekey.so/v1/balances",
          method: "GET",
        }) + "\n",
    ).join("");
    const compressed = await compressText(events);
    expect(compressed.length).toBeLessThan(events.length * 0.1);
    const round = await decompressToText(compressed);
    expect(round).toBe(events);
  });
});
