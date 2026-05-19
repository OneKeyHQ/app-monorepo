// MCP stdio server. Thin proxy that exposes the daemon's JSON-RPC tools to
// MCP clients (e.g. AI assistants). Each MCP `tools/call` is forwarded to
// the daemon over the Unix socket via `call(...)` and the JSON result is
// returned as a single TextContent block.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { call, RpcClientError } from "../cli/rpcClient.js";

interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Tool schemas mirror the daemon's JSON-RPC method names so the MCP server
// can forward `name` straight through without a translation table.
const TOOLS: ToolSpec[] = [
  {
    name: "session.attach",
    description:
      "Attach to a device + app. Returns a session id usable by other tools. Required before every other call.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["ios", "android"] },
        deviceId: {
          type: "string",
          description: "iOS UDID (or 'booted'), or Android adb serial.",
        },
        appBundle: {
          type: "string",
          description: "App bundle id / package name.",
          default: "com.onekey.wallet",
        },
      },
      required: ["platform", "deviceId"],
    },
  },
  {
    name: "session.list",
    description: "List active sessions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "session.detach",
    description: "Detach an attached session.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "session.status",
    description: "Show session adapters' health.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "screenshot",
    description:
      "Capture the device screen as PNG. Returns the saved file path and byte size.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "ui.tree",
    description:
      "Return the native UI hierarchy as a JSON tree (Android uiautomator; iOS sim lldb recursiveDescription).",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "js.eval",
    description:
      "Evaluate a JavaScript expression in the Hermes runtime via CDP. Returns {value, type}. Awaits promises by default.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        expression: { type: "string" },
      },
      required: ["sessionId", "expression"],
    },
  },
  {
    name: "js.console.tail",
    description:
      "Return recent Hermes console entries (last N, optional since-filter).",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        since: { type: "number", description: "unix ms" },
        limit: { type: "number", default: 200, maximum: 500 },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "js.network.list",
    description: "List captured network requests for the session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        since: { type: "number", description: "unix ms" },
        limit: { type: "number", default: 100, maximum: 500 },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "js.network.body",
    description: "Fetch a captured response body by requestId.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        requestId: { type: "string" },
      },
      required: ["sessionId", "requestId"],
    },
  },
  {
    name: "webview.list",
    description:
      "List WebView CDP targets for the session (iOS via ios-webkit-debug-proxy, Android via adb forward).",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        port: {
          type: "number",
          description: "iOS only — iwdp HTTP port (default 27753)",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "webview.eval",
    description: "Evaluate a JS expression inside a specific WebView target.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        targetId: {
          type: "string",
          description: "CDP target id from webview.list",
        },
        expression: { type: "string" },
        returnByValue: { type: "boolean", default: true },
        awaitPromise: { type: "boolean", default: true },
      },
      required: ["sessionId", "targetId", "expression"],
    },
  },
  {
    name: "webview.dom.query",
    description:
      "DOM.querySelectorAll inside a WebView; returns first match outerHTML + total count.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        targetId: { type: "string" },
        selector: { type: "string" },
      },
      required: ["sessionId", "targetId", "selector"],
    },
  },
  {
    name: "native.call",
    description:
      "Call an ObjC selector or Java static method via Frida. Selectors look like \"-[UIApplication sharedApplication]\" (iOS) or \"android.app.ActivityThread.currentApplication\" (Android).",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        selector: { type: "string" },
        args: { type: "array", default: [] },
      },
      required: ["sessionId", "selector"],
    },
  },
  {
    name: "native.hook",
    description:
      "Attach an enter/leave hook to a native method via Frida. Returns a hookId — events stream into the session's ring buffer; drain with native.events.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        method: { type: "string" },
      },
      required: ["sessionId", "method"],
    },
  },
  {
    name: "native.unhook",
    description: "Detach a previously installed hook.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        hookId: { type: "number" },
      },
      required: ["sessionId", "hookId"],
    },
  },
  {
    name: "native.listHooks",
    description: "List active native hooks for the session.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "native.events",
    description:
      "Drain queued native hook fire events (FIFO; ring buffer caps at 1000).",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        max: { type: "number", default: 100, maximum: 1000 },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "native.script.run",
    description:
      "Load and run an arbitrary Frida JS script in the agent's context. The script receives an `exports` object; returns {ok, exports} or {ok:false, error}.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        source: { type: "string" },
      },
      required: ["sessionId", "source"],
    },
  },
  {
    name: "perf.metrics",
    description:
      "One-shot perf snapshot in a unified shape: {cpu_pct, mem_rss_mb, mem_js_heap_mb, fps, jank_pct, thread_count}. Missing readings are null. iOS FPS/jank are null outside an active trace window.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "perf.fps.tail",
    description:
      "Sample FPS over a short window and return the time series. Defaults: 5 seconds at 2 Hz.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        durationSeconds: { type: "number", default: 5 },
        sampleHz: { type: "number", default: 2 },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "perf.memory.classes",
    description:
      "Top N memory-consuming categories from `dumpsys meminfo -d` (Android). iOS returns an empty list in MVP.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        top: { type: "number", default: 20 },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "perf.trace.start",
    description:
      "Spawn `xctrace record` (iOS) or `perfetto -c` (Android) for `durationSeconds` and write to ~/.onekey-debug/traces. Returns a traceId; pair with perf.trace.stop to finalize.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        kind: { type: "string", enum: ["xctrace", "perfetto"] },
        durationSeconds: { type: "number", default: 10 },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "perf.trace.stop",
    description:
      "Finalize the active trace window. Returns the saved trace path; with convertToChromeTrace=true, attempts an xctrace export → chrome trace JSON conversion (perfetto requires host `traceconv`).",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        convertToChromeTrace: { type: "boolean", default: false },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "record.start",
    description:
      "Start a multi-layer .odb recording for the session. Layers default to all four (js, network, native, ui). Returns {recordId, path}.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        layers: {
          type: "array",
          items: { type: "string", enum: ["js", "network", "native", "ui"] },
        },
        uiIntervalMs: {
          type: "number",
          description: "UI snapshot interval (default 2000, min 500).",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "record.stop",
    description:
      "Stop the active recording for the session and finalize the .odb directory. Returns {path, eventCount, durationMs}.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "record.status",
    description: "Return whether the session has an active recording.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "replay",
    description:
      "Replay a recorded .odb directory. Only js.eval events are re-executed (on `targetSessionId`); other layers are dry-run. Returns counts {replayed, skipped, errors}.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the .odb directory." },
        targetSessionId: {
          type: "string",
          description: "Session to re-execute js.eval events against.",
        },
        layers: {
          type: "array",
          items: { type: "string", enum: ["js", "network", "native", "ui"] },
          default: ["js"],
        },
        speed: { type: "number", description: "1.0 = real time" },
      },
      required: ["path"],
    },
  },
  {
    name: "timeline",
    description:
      "Inspect events near a timestamp (ms relative to recording start) within ±windowMs/2 of `t`. Returns {manifest, events}.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        t: { type: "number" },
        windowMs: { type: "number", default: 1000 },
      },
      required: ["path", "t"],
    },
  },
];

export const server = new Server(
  { name: "onekey-debug-bridge", version: "0.1.0-mvp" },
  { capabilities: { tools: {} } },
);

export const tools: ReadonlyArray<ToolSpec> = TOOLS;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params?.name;
  const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
  if (typeof name !== "string") {
    return {
      isError: true,
      content: [
        { type: "text", text: JSON.stringify({ error: "missing tool name" }) },
      ],
    };
  }
  try {
    const out = await call(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
    };
  } catch (e) {
    const msg = e instanceof RpcClientError ? e.message : String(e);
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
    };
  }
});

export async function run(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only auto-run when executed as the entry script (not when imported by tests
// or the bin shim that does its own `import(compiled)`).
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e: unknown) => {
    process.stderr.write(`odb-mcp fatal: ${(e as Error).message}\n`);
    process.exit(1);
  });
}
