// Smoke test: the MCP server module loads, exposes a Server instance,
// provides a run() entry, and lists every MVP tool we expect.
import { describe, it, expect } from "vitest";

describe("MCP server module", () => {
  it("loads without throwing", async () => {
    const m = await import("../src/mcp/server.ts");
    expect(m.server).toBeDefined();
    expect(typeof m.run).toBe("function");
  });

  it("exposes all MVP tools", async () => {
    const { tools } = await import("../src/mcp/server.ts");
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "js.console.tail",
        "js.eval",
        "js.network.body",
        "js.network.list",
        "screenshot",
        "session.attach",
        "session.detach",
        "session.list",
        "session.status",
        "ui.tree",
      ].sort(),
    );
  });
});
