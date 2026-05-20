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
  .command("webview-list <sessionId>")
  .description("List WebView CDP targets")
  .option("-p, --port <port>", "iOS only — iwdp HTTP port (default 27753)", (v) =>
    parseInt(v, 10),
  )
  .action(async (sessionId: string, opts: { port?: number }) => {
    process.stdout.write(
      JSON.stringify(
        await call("webview.list", { sessionId, port: opts.port }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("webview-eval <sessionId> <targetId> <expression>")
  .description("Evaluate JS inside a WebView")
  .action(
    async (sessionId: string, targetId: string, expression: string) => {
      process.stdout.write(
        JSON.stringify(
          await call("webview.eval", { sessionId, targetId, expression }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("webview-dom-query <sessionId> <targetId> <selector>")
  .description(
    "DOM.querySelectorAll inside a WebView (returns first outerHTML + count)",
  )
  .action(
    async (sessionId: string, targetId: string, selector: string) => {
      process.stdout.write(
        JSON.stringify(
          await call("webview.dom.query", { sessionId, targetId, selector }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("native-call <sessionId> <selector>")
  .description("Call an ObjC selector or Java static method via Frida")
  .option("--args <json>", "JSON array of arguments", "[]")
  .action(async (sessionId: string, selector: string, opts: { args: string }) => {
    const args = JSON.parse(opts.args) as unknown[];
    process.stdout.write(
      JSON.stringify(await call("native.call", { sessionId, selector, args }), null, 2) + "\n",
    );
  });

program
  .command("native-hook <sessionId> <method>")
  .description("Attach a hook to a native method; returns hookId")
  .action(async (sessionId: string, method: string) => {
    process.stdout.write(
      JSON.stringify(await call("native.hook", { sessionId, method }), null, 2) + "\n",
    );
  });

program
  .command("native-unhook <sessionId> <hookId>")
  .description("Detach a previously installed hook")
  .action(async (sessionId: string, hookId: string) => {
    process.stdout.write(
      JSON.stringify(
        await call("native.unhook", { sessionId, hookId: parseInt(hookId, 10) }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("native-list-hooks <sessionId>")
  .description("List active hook ids")
  .action(async (sessionId: string) => {
    process.stdout.write(
      JSON.stringify(await call("native.listHooks", { sessionId }), null, 2) + "\n",
    );
  });

program
  .command("native-events <sessionId>")
  .option("--max <n>", "max events to drain", (v) => parseInt(v, 10))
  .description("Drain queued hook events (FIFO, ring-buffer of 1000)")
  .action(async (sessionId: string, opts: { max?: number }) => {
    process.stdout.write(
      JSON.stringify(
        await call("native.events", { sessionId, max: opts.max }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("native-script-run <sessionId> <sourceFile>")
  .description("Load + run a Frida JS script (path to a .js file)")
  .action(async (sessionId: string, sourceFile: string) => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(sourceFile, "utf8");
    process.stdout.write(
      JSON.stringify(
        await call("native.script.run", { sessionId, source }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("perf-metrics <sessionId>")
  .description("One-shot performance snapshot (cpu/rss/fps/jank/threads)")
  .action(async (sessionId: string) => {
    process.stdout.write(
      JSON.stringify(await call("perf.metrics", { sessionId }), null, 2) + "\n",
    );
  });

program
  .command("perf-fps-tail <sessionId>")
  .option("--duration <s>", "window in seconds", (v) => parseInt(v, 10))
  .option("--hz <n>", "sample frequency Hz", (v) => parseInt(v, 10))
  .description("Collect FPS samples over a window")
  .action(
    async (
      sessionId: string,
      opts: { duration?: number; hz?: number },
    ) => {
      process.stdout.write(
        JSON.stringify(
          await call("perf.fps.tail", {
            sessionId,
            durationSeconds: opts.duration,
            sampleHz: opts.hz,
          }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("perf-memory-classes <sessionId>")
  .option("--top <n>", "top N classes", (v) => parseInt(v, 10))
  .description("Top N memory-consuming classes (Android-only for MVP)")
  .action(async (sessionId: string, opts: { top?: number }) => {
    process.stdout.write(
      JSON.stringify(
        await call("perf.memory.classes", { sessionId, top: opts.top }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("perf-trace-start <sessionId>")
  .option("--kind <xctrace|perfetto>", "trace backend")
  .option("--duration <s>", "duration in seconds", (v) => parseInt(v, 10))
  .description("Start an xctrace (iOS) or perfetto (Android) trace window")
  .action(
    async (
      sessionId: string,
      opts: { kind?: "xctrace" | "perfetto"; duration?: number },
    ) => {
      process.stdout.write(
        JSON.stringify(
          await call("perf.trace.start", {
            sessionId,
            kind: opts.kind,
            durationSeconds: opts.duration,
          }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("perf-trace-stop <sessionId>")
  .option("--convert", "convert to chrome trace JSON when possible", false)
  .description("Stop the active trace window and return saved path")
  .action(async (sessionId: string, opts: { convert?: boolean }) => {
    process.stdout.write(
      JSON.stringify(
        await call("perf.trace.stop", {
          sessionId,
          convertToChromeTrace: opts.convert,
        }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("record-start <sessionId>")
  .option(
    "--layers <csv>",
    "comma-separated: js,network,native,ui",
    "js,network,native,ui",
  )
  .option("--ui-interval <ms>", "ui snapshot interval", (v) => parseInt(v, 10))
  .description("Start a multi-layer .odb recording for the session")
  .action(
    async (
      sessionId: string,
      opts: { layers: string; uiInterval?: number },
    ) => {
      const layers = opts.layers.split(",") as (
        | "js"
        | "network"
        | "native"
        | "ui"
      )[];
      process.stdout.write(
        JSON.stringify(
          await call("record.start", {
            sessionId,
            layers,
            uiIntervalMs: opts.uiInterval,
          }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("record-stop <sessionId>")
  .description("Stop the active recording and finalize the .odb directory")
  .action(async (sessionId: string) => {
    process.stdout.write(
      JSON.stringify(await call("record.stop", { sessionId }), null, 2) + "\n",
    );
  });

program
  .command("record-status <sessionId>")
  .description("Whether the session currently has an active recording")
  .action(async (sessionId: string) => {
    process.stdout.write(
      JSON.stringify(await call("record.status", { sessionId }), null, 2) +
        "\n",
    );
  });

program
  .command("replay <path>")
  .option(
    "--target <sessionId>",
    "target session for js / native re-execution",
  )
  .option("--layers <csv>", "layers to replay", "js")
  .option("--speed <n>", "speed multiplier (1.0 = real time)", (v) =>
    parseFloat(v),
  )
  .option(
    "--apply",
    "actually execute native calls (default: dry-run; native is destructive)",
  )
  .option(
    "--confirm-token <t>",
    "required when --apply and --layers includes native",
  )
  .description("Replay a recorded .odb directory onto a live session")
  .action(
    async (
      p: string,
      opts: {
        target?: string;
        layers: string;
        speed?: number;
        apply?: boolean;
        confirmToken?: string;
      },
    ) => {
      process.stdout.write(
        JSON.stringify(
          await call("replay", {
            path: p,
            targetSessionId: opts.target,
            layers: opts.layers.split(","),
            speed: opts.speed,
            apply: opts.apply,
            confirmToken: opts.confirmToken,
          }),
          null,
          2,
        ) + "\n",
      );
    },
  );

program
  .command("replay-token <path>")
  .option("--target <sessionId>", "target session id")
  .option("--layers <csv>", "layers to replay", "js,native")
  .description(
    "Compute the confirm token required for `replay --apply --layers native`",
  )
  .action(async (p: string, opts: { target?: string; layers: string }) => {
    process.stdout.write(
      JSON.stringify(
        await call("replay.token", {
          path: p,
          targetSessionId: opts.target,
          layers: opts.layers.split(","),
        }),
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("timeline <path>")
  .requiredOption("--t <ms>", "ms relative to recording start", (v) =>
    parseInt(v, 10),
  )
  .option("--window <ms>", "window size in ms", (v) => parseInt(v, 10))
  .description("Inspect events near a timestamp in a recorded .odb")
  .action(async (p: string, opts: { t: number; window?: number }) => {
    process.stdout.write(
      JSON.stringify(
        await call("timeline", { path: p, t: opts.t, windowMs: opts.window }),
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
