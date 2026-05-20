// Smoke test: the MCP server module loads, exposes a Server instance,
// provides a run() entry, and lists every MVP tool we expect.
import { describe, it, expect } from "vitest";

describe("MCP server module", () => {
  it("loads without throwing", async () => {
    const m = await import("../src/mcp/server.ts");
    expect(m.server).toBeDefined();
    expect(typeof m.run).toBe("function");
  });

  it("exposes all MVP + V1 tools", async () => {
    const { tools } = await import("../src/mcp/server.ts");
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "js.console.tail",
        "js.eval",
        "js.network.body",
        "js.network.list",
        "native.call",
        "native.events",
        "native.hook",
        "native.listHooks",
        "native.script.run",
        "native.unhook",
        "perf.fps.tail",
        "perf.memory.classes",
        "perf.metrics",
        "perf.trace.start",
        "perf.trace.stop",
        "record.start",
        "record.status",
        "record.stop",
        "replay",
        "replay.token",
        "screenshot",
        "session.attach",
        "session.detach",
        "session.list",
        "session.status",
        "timeline",
        "ui.tree",
        "webview.dom.query",
        "webview.eval",
        "webview.list",
      ].sort(),
    );
  });
});
