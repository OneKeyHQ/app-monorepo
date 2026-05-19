import { Command } from "commander";
import { runAll as runDoctor } from "./doctor.js";
import { call, RpcClientError } from "./rpcClient.js";

const program = new Command("odb")
  .description("OneKey native debug bridge CLI")
  .showHelpAfterError();

const daemon = program.command("daemon").description("Daemon lifecycle");

daemon
  .command("status")
  .description("Ping the daemon")
  .action(async () => {
    try {
      const out = await call("ping");
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    } catch (e) {
      if (e instanceof RpcClientError) {
        process.stderr.write(`daemon: down (${e.message})\n`);
        process.exit(1);
      }
      throw e;
    }
  });

const session = program.command("session").description("Session management");

session
  .command("attach")
  .requiredOption("-p, --platform <ios|android>", "device platform")
  .requiredOption("-d, --device <id>", "udid or adb serial")
  .option("-a, --app <bundle>", "app bundle id", "com.onekey.wallet")
  .action(async (opts: { platform: string; device: string; app: string }) => {
    const out = await call("session.attach", {
      platform: opts.platform,
      deviceId: opts.device,
      appBundle: opts.app,
    });
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  });

session
  .command("list")
  .description("List active sessions")
  .action(async () => {
    process.stdout.write(
      JSON.stringify(await call("session.list"), null, 2) + "\n",
    );
  });

session
  .command("detach <sessionId>")
  .description("Detach a session by id")
  .action(async (sessionId: string) => {
    process.stdout.write(
      JSON.stringify(await call("session.detach", { sessionId }), null, 2) +
        "\n",
    );
  });

session
  .command("status <sessionId>")
  .description("Show session status (adapter health)")
  .action(async (sessionId: string) => {
    process.stdout.write(
      JSON.stringify(await call("session.status", { sessionId }), null, 2) +
        "\n",
    );
  });

program
  .command("screenshot <sessionId>")
  .description("Capture the device screen; returns saved PNG path")
  .action(async (sessionId: string) => {
    const out = await call("screenshot", { sessionId });
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  });

program
  .command("ui-tree <sessionId>")
  .description("Native UI hierarchy as JSON tree")
  .action(async (sessionId: string) => {
    process.stdout.write(
      JSON.stringify(await call("ui.tree", { sessionId }), null, 2) + "\n",
    );
  });

program
  .command("js-eval <sessionId> <expression>")
  .description("Evaluate a JS expression in Hermes; returns {value, type}")
  .action(async (sessionId: string, expression: string) => {
    process.stdout.write(
      JSON.stringify(await call("js.eval", { sessionId, expression }), null, 2) +
        "\n",
    );
  });

program
  .command("console-tail <sessionId>")
  .option("--since <ts>", "unix ms timestamp", (v) => parseInt(v, 10))
  .option("--limit <n>", "max entries", (v) => parseInt(v, 10))
  .description("Last N console entries from Hermes")
  .action(
    async (
      sessionId: string,
      opts: { since?: number; limit?: number },
    ) => {
      process.stdout.write(
        JSON.stringify(
          await call("js.console.tail", {
            sessionId,
            since: opts.since,
            limit: opts.limit,
          }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("network-list <sessionId>")
  .option("--since <ts>", "unix ms", (v) => parseInt(v, 10))
  .option("--limit <n>", "max", (v) => parseInt(v, 10))
  .description("List network requests captured in this session")
  .action(
    async (
      sessionId: string,
      opts: { since?: number; limit?: number },
    ) => {
      process.stdout.write(
        JSON.stringify(
          await call("js.network.list", {
            sessionId,
            since: opts.since,
            limit: opts.limit,
          }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("network-body <sessionId> <requestId>")
  .description("Fetch a request body by its CDP requestId")
  .action(async (sessionId: string, requestId: string) => {
    process.stdout.write(
      JSON.stringify(
        await call("js.network.body", { sessionId, requestId }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("doctor")
  .description("Pre-flight checks (adb, xcrun, lldb, Hermes, devices, frida)")
  .action(async () => {
    const checks = await runDoctor();
    for (const c of checks) {
      const mark = c.ok ? "✓" : "✗";
      const detail = c.detail ? `  (${c.detail})` : "";
      process.stdout.write(`  ${mark} ${c.name}${detail}\n`);
      if (!c.ok && c.fix) {
        process.stdout.write(`      fix: ${c.fix}\n`);
      }
    }
    const fails = checks.filter((c) => !c.ok).length;
    process.exit(fails === 0 ? 0 : 1);
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
  process.exit(1);
});
