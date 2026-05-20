import { pino } from "pino";
import { consoleTail } from "../tools/jsConsole.js";
import { jsEval } from "../tools/jsEval.js";
import { networkBody, networkList } from "../tools/jsNetwork.js";
import {
  nativeCall,
  nativeEvents,
  nativeHook,
  nativeListHooks,
  nativeScriptRun,
  nativeUnhook,
} from "../tools/native.js";
import {
  perfFpsTail,
  perfMemoryClasses,
  perfMetrics,
  perfTraceStart,
  perfTraceStop,
} from "../tools/perf.js";
import {
  recordReplay,
  recordReplayToken,
  recordStart,
  recordStatus,
  recordStop,
  recordTimeline,
} from "../tools/record.js";
import { screenshot } from "../tools/screenshot.js";
import { uiTree } from "../tools/uiTree.js";
import {
  webviewDomQuery,
  webviewEval,
  webviewList,
} from "../tools/webview.js";
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
  d.register("js.console.tail", (p) => consoleTail(registry, p as never));
  d.register("js.network.list", (p) => networkList(registry, p as never));
  d.register("js.network.body", (p) => networkBody(registry, p as never));
  d.register("webview.list", (p) => webviewList(registry, p as never));
  d.register("webview.eval", (p) => webviewEval(registry, p as never));
  d.register("webview.dom.query", (p) => webviewDomQuery(registry, p as never));
  d.register("native.call", (p) => nativeCall(registry, p as never));
  d.register("native.hook", (p) => nativeHook(registry, p as never));
  d.register("native.unhook", (p) => nativeUnhook(registry, p as never));
  d.register("native.listHooks", (p) => nativeListHooks(registry, p as never));
  d.register("native.events", (p) => nativeEvents(registry, p as never));
  d.register("native.script.run", (p) => nativeScriptRun(registry, p as never));
  d.register("perf.metrics", (p) => perfMetrics(registry, p as never));
  d.register("perf.fps.tail", (p) => perfFpsTail(registry, p as never));
  d.register("perf.memory.classes", (p) =>
    perfMemoryClasses(registry, p as never),
  );
  d.register("perf.trace.start", (p) => perfTraceStart(registry, p as never));
  d.register("perf.trace.stop", (p) => perfTraceStop(registry, p as never));
  d.register("record.start", (p) => recordStart(registry, p as never));
  d.register("record.stop", (p) => recordStop(registry, p as never));
  d.register("record.status", (p) => recordStatus(registry, p as never));
  d.register("replay", (p) => recordReplay(registry, p as never));
  d.register("replay.token", (p) => recordReplayToken(registry, p as never));
  d.register("timeline", (p) => recordTimeline(registry, p as never));

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
