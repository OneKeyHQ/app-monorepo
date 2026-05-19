import { describe, it, expect } from "vitest";
import { Dispatcher } from "../src/daemon/dispatcher.js";
import { JsonRpcException } from "../src/shared/jsonRpc.js";

describe("Dispatcher", () => {
  it("dispatches a known method", async () => {
    const d = new Dispatcher();
    d.register("ping", () => ({ pong: true }));
    const r = await d.handle({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(r).toEqual({ jsonrpc: "2.0", id: 1, result: { pong: true } });
  });

  it("returns -32601 for unknown method", async () => {
    const d = new Dispatcher();
    const r = await d.handle({ jsonrpc: "2.0", id: 2, method: "unknown" });
    expect("error" in r && r.error.code).toBe(-32601);
  });

  it("returns -32600 for invalid shape", async () => {
    const d = new Dispatcher();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await d.handle({ not: "jsonrpc" } as any);
    expect("error" in r && r.error.code).toBe(-32600);
  });

  it("wraps thrown exceptions as -32603 internal error", async () => {
    const d = new Dispatcher();
    d.register("boom", () => {
      throw new Error("boom");
    });
    const r = await d.handle({ jsonrpc: "2.0", id: 3, method: "boom" });
    expect("error" in r && r.error.code).toBe(-32603);
    expect("error" in r && r.error.message).toContain("boom");
  });

  it("respects JsonRpcException code", async () => {
    const d = new Dispatcher();
    d.register("bad", () => {
      throw new JsonRpcException(-32004, "missing");
    });
    const r = await d.handle({ jsonrpc: "2.0", id: 4, method: "bad" });
    expect("error" in r && r.error.code).toBe(-32004);
  });

  it("passes object params as one positional arg", async () => {
    const d = new Dispatcher();
    d.register("add", (p: Record<string, unknown>) => {
      const { a, b } = p as { a: number; b: number };
      return { sum: a + b };
    });
    const r = await d.handle({
      jsonrpc: "2.0",
      id: 5,
      method: "add",
      params: { a: 1, b: 2 },
    });
    expect("result" in r && r.result).toEqual({ sum: 3 });
  });
});
