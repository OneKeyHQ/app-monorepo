import { pino } from "pino";
import { jsEval } from "../tools/jsEval.js";
import { screenshot } from "../tools/screenshot.js";
import { uiTree } from "../tools/uiTree.js";
import { Dispatcher } from "./dispatcher.js";
import { Registry } from "./registry.js";
import { UnixSocketServer } from "./server.js";

const log = pino({ name: "daemon-main" });

const DEFAULT_SOCKET =
  process.env.ODB_SOCKET ?? "/tmp/onekey-debug-bridge.sock";

async function main(): Promise<void> {
  const registry = new Registry();
  const d = new Dispatcher();
  d.register("ping", () => ({ pong: true, pid: process.pid }));
  d.register("session.attach", (p) => registry.attach(p as never));
  d.register("session.detach", (p) => registry.detach(p as never));
  d.register("session.list", () => registry.list());
  d.register("session.status", (p) => registry.status(p as never));
  d.register("screenshot", (p) => screenshot(registry, p as never));
  d.register("ui.tree", (p) => uiTree(registry, p as never));
  d.register("js.eval", (p) => jsEval(registry, p as never));

  const server = new UnixSocketServer(DEFAULT_SOCKET, d);
  await server.start();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, "shutting down");
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  log.error({ err: e }, "daemon crashed");
  process.exit(1);
});
