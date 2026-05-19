import { describe, it, expect } from "vitest";
import { request } from "node:http";

function hermesUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const r = request(
      { host: "127.0.0.1", port: 8081, path: "/json/list", timeout: 500 },
      (resp) => {
        resp.resume();
        resolve(resp.statusCode === 200);
      },
    );
    r.on("error", () => resolve(false));
    r.on("timeout", () => {
      r.destroy();
      resolve(false);
    });
    r.end();
  });
}

const HERMES_UP = await hermesUp();

describe.skipIf(!HERMES_UP)("CDP (live)", () => {
  it("evaluates 1+1", async () => {
    const { attachHermes } = await import("../src/adapters/cdp.js");
    const h = await attachHermes();
    try {
      const r = (await h.client.Runtime.evaluate({
        expression: "1+1",
        returnByValue: true,
      })) as { result: { value?: unknown } };
      expect(r.result.value).toBe(2);
    } finally {
      await h.close();
    }
  });
});

describe("CDP (offline placeholder)", () => {
  it("hermes-up probe doesn't crash when no metro", () => {
    // ensures the probe path itself is harmless
    expect(typeof HERMES_UP).toBe("boolean");
  });
});
