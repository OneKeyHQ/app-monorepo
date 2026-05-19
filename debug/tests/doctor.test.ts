import { describe, expect, it } from "vitest";
import { runAll } from "../src/cli/doctor.js";

describe("doctor.runAll", () => {
  it("returns the expected pre-flight check set", async () => {
    const checks = await runAll();
    const names = checks.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "adb",
        "xcrun simctl",
        "lldb",
        "Hermes :8081",
        "iOS sim booted",
        "adb devices",
        "frida (Node package)",
      ]),
    );
    // every entry has a boolean ok flag
    for (const c of checks) {
      expect(typeof c.ok).toBe("boolean");
    }
  }, 5000);
});
