import { Command } from "commander";
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

program.parseAsync(process.argv).catch((e: unknown) => {
  process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
  process.exit(1);
});
