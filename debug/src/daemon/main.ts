import { pino } from "pino";
import { Dispatcher } from "./dispatcher.js";
import { UnixSocketServer } from "./server.js";

const log = pino({ name: "daemon-main" });

const DEFAULT_SOCKET =
  process.env.ODB_SOCKET ?? "/tmp/onekey-debug-bridge.sock";

async function main(): Promise<void> {
  const d = new Dispatcher();
  d.register("ping", () => ({ pong: true, pid: process.pid }));

  const server = new UnixSocketServer(DEFAULT_SOCKET, d);
  await server.start();

  const shutdown = async (signal: string) => {
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
