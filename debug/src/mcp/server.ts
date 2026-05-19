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
