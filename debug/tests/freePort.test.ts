import { describe, it, expect } from "vitest";
import { pickFreePort } from "../src/shared/freePort.js";

describe("pickFreePort", () => {
  it("returns a number in the valid TCP port range", async () => {
    const p = await pickFreePort();
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(65536);
  });

  it("returns distinct ports on rapid concurrent calls", async () => {
    const ports = await Promise.all([
      pickFreePort(),
      pickFreePort(),
      pickFreePort(),
    ]);
    const uniq = new Set(ports);
    // Not guaranteed all 3 distinct due to OS TIME_WAIT semantics, but at
    // least 2 should differ on any healthy system.
    expect(uniq.size).toBeGreaterThanOrEqual(2);
  });
});
