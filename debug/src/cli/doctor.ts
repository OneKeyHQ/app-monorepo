import { execa } from "execa";
import { request } from "node:http";

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
  fix?: string;
}

async function hasBinary(cmd: string): Promise<boolean> {
  try {
    await execa("which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

interface HermesProbe {
  ok: boolean;
  detail: string;
}

async function hermesReachable(): Promise<HermesProbe> {
  return new Promise((resolve) => {
    const r = request(
      { host: "127.0.0.1", port: 8081, path: "/json/list", timeout: 800 },
      (resp) => {
        let body = "";
        resp.on("data", (c) => {
          body += c.toString();
        });
        resp.on("end", () => {
          if (resp.statusCode !== 200) {
            resolve({ ok: false, detail: `HTTP ${resp.statusCode}` });
            return;
          }
          try {
            const arr = JSON.parse(body) as unknown[];
            resolve({ ok: true, detail: `${arr.length} target(s)` });
          } catch (e) {
            resolve({ ok: false, detail: `bad JSON: ${(e as Error).message}` });
          }
        });
      },
    );
    r.on("error", (e) => resolve({ ok: false, detail: e.message }));
    r.on("timeout", () => {
      r.destroy();
      resolve({ ok: false, detail: "timeout" });
    });
    r.end();
  });
}

export async function runAll(): Promise<Check[]> {
  const checks: Check[] = [];

  checks.push({
    name: "adb",
    ok: await hasBinary("adb"),
    fix: "brew install android-platform-tools",
  });
  checks.push({
    name: "xcrun simctl",
    ok: await hasBinary("xcrun"),
    fix: "install Xcode + Command Line Tools",
  });
  checks.push({
    name: "lldb",
    ok: await hasBinary("lldb"),
    fix: "ships with Xcode",
  });
  // brew installs the binary with underscores: ios_webkit_debug_proxy
  checks.push({
    name: "ios-webkit-debug-proxy",
    ok: await hasBinary("ios_webkit_debug_proxy"),
    fix: "brew install ios-webkit-debug-proxy (only needed for iOS WebView debugging)",
  });

  const h = await hermesReachable();
  checks.push({
    name: "Hermes :8081",
    ok: h.ok,
    detail: h.detail,
    fix: "run `yarn app:ios` or `yarn app:android` first",
  });

  try {
    const r = await execa("xcrun", ["simctl", "list", "devices", "booted"], {
      reject: false,
    });
    const booted = (r.stdout ?? "").includes("Booted");
    checks.push({
      name: "iOS sim booted",
      ok: booted,
      detail: booted ? "" : "no booted simulator",
      fix: "xcrun simctl boot 'iPhone 15 Pro'",
    });
  } catch (e) {
    checks.push({
      name: "iOS sim booted",
      ok: false,
      detail: (e as Error).message,
    });
  }

  try {
    const r = await execa("adb", ["devices"], { reject: false });
    const lines = (r.stdout ?? "").split("\n").slice(1);
    const n = lines.filter((l) => l.includes("\tdevice")).length;
    checks.push({
      name: "adb devices",
      ok: n > 0,
      detail: `${n} device(s)`,
      fix: "plug in / start emulator (`emulator @<avd>`)",
    });
  } catch (e) {
    checks.push({
      name: "adb devices",
      ok: false,
      detail: (e as Error).message,
    });
  }

  // Frida CLI availability (Node 'frida' package is installed; the CLI may not
  // be on PATH). We only verify the Node module can be loaded.
  checks.push({
    name: "frida (Node package)",
    ok: await import("frida")
      .then(() => true)
      .catch(() => false),
    fix: "yarn install (should already be a dep)",
  });

  // Optional host tools for perf.trace.* — informational only. Missing
  // entries don't fail the doctor run.
  checks.push({
    name: "xctrace",
    ok: await hasBinary("xctrace"),
    fix: "ships with Xcode (only needed for iOS perf traces)",
  });
  checks.push({
    name: "perfetto host",
    ok: (await hasBinary("perfetto")) || (await hasBinary("traceconv")),
    fix: "optional: install perfetto tools for host-side trace conversion",
  });

  return checks;
}
