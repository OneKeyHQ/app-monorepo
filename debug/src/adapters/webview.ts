import CDP from "chrome-remote-interface";
import { request } from "node:http";
import { execa, type ResultPromise } from "execa";

export interface WebViewPage {
  id: string; // CDP target id
  title: string;
  url: string;
  type: string; // "web-page", "service_worker", "page", etc.
  webSocketDebuggerUrl: string;
}

export interface WebViewAttachHandle {
  client: CDP.Client;
  close: () => Promise<void>;
}

type IwdpProc = ResultPromise<{
  stdio: "ignore";
  reject: false;
  cleanup: true;
}>;

/**
 * Spawn ios-webkit-debug-proxy and wait for its HTTP listing to be reachable.
 * The returned `stop()` terminates the helper; caller is responsible for
 * calling it on session teardown.
 */
export async function spawnIWDP(
  deviceId: string,
  httpPort = 27753,
): Promise<{ proc: IwdpProc; stop: () => Promise<void> }> {
  const proc = spawnHelper(deviceId, httpPort);

  for (let i = 0; i < 50; i += 1) {
    if (await httpListReachable(httpPort)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!(await httpListReachable(httpPort))) {
    try {
      proc.kill("SIGTERM");
    } catch {
      // ignore — process may already be gone
    }
    throw new Error(
      `ios-webkit-debug-proxy didn't come up on :${httpPort}. Install via \`brew install ios-webkit-debug-proxy\` and ensure the device is paired + Web Inspector is enabled in Safari → Settings.`,
    );
  }

  return {
    proc,
    stop: async () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    },
  };
}

function spawnHelper(deviceId: string, httpPort: number): IwdpProc {
  // device-arg: real device → udid; sim → "null" (iwdp magic)
  const dev =
    deviceId === "booted" || /^[0-9A-F-]{36,}$/.test(deviceId)
      ? deviceId
      : "null";
  return execa(
    "ios_webkit_debug_proxy",
    ["-c", `${dev}:${httpPort}:`, "-d"],
    { stdio: "ignore", reject: false, cleanup: true },
  );
}

async function httpListReachable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const r = request(
      { host: "127.0.0.1", port, path: "/json", timeout: 200 },
      (resp) => {
        resp.resume();
        resolve(resp.statusCode === 200);
      },
    );
    r.on("error", () => resolve(false));
    r.on("timeout", () => {
      r.destroy();
      resolve(false);
    });
    r.end();
  });
}

export async function listWebViewPagesIos(port = 27753): Promise<WebViewPage[]> {
  const targets = (await CDP.List({ port })) as unknown as WebViewPage[];
  return targets.filter((t) => !!t.webSocketDebuggerUrl);
}

/**
 * Forward an Android WebView's devtools socket to a local TCP port and return
 * the forwarded port + an unforward callback.
 */
export async function forwardAndroidWebView(
  serial: string,
  pkg: string,
): Promise<{ port: number; unforward: () => Promise<void> }> {
  // Discover any webview_devtools_remote socket; pkg may be used to narrow
  // future heuristics but currently is informational only.
  const r = await execa("adb", ["-s", serial, "shell", "cat", "/proc/net/unix"]);
  const line = r.stdout
    .split("\n")
    .find((l) => /webview_devtools_remote/.test(l));
  if (!line) {
    throw new Error(
      `no webview_devtools_remote socket on ${serial}; ensure the app has \`WebView.setWebContentsDebuggingEnabled(true)\` and is showing a WebView. pkg=${pkg}`,
    );
  }
  const m = /webview_devtools_remote(?:_(\d+))?/.exec(line);
  const sockname = m
    ? `webview_devtools_remote${m[1] ? `_${m[1]}` : ""}`
    : "webview_devtools_remote";

  // `adb forward tcp:0 localabstract:<sockname>` lets adb pick a free port
  const fr = await execa("adb", [
    "-s",
    serial,
    "forward",
    "tcp:0",
    `localabstract:${sockname}`,
  ]);
  const port = parseInt(fr.stdout.trim(), 10);

  return {
    port,
    unforward: async () => {
      await execa(
        "adb",
        ["-s", serial, "forward", "--remove", `tcp:${port}`],
        { reject: false },
      );
    },
  };
}

export async function listWebViewPagesAndroid(
  port: number,
): Promise<WebViewPage[]> {
  return (await CDP.List({ port })) as unknown as WebViewPage[];
}

export async function attachWebViewByTarget(
  target: WebViewPage,
): Promise<WebViewAttachHandle> {
  // CRI's `Target` type requires `description` + `devtoolsFrontendUrl` that
  // some WebView listings (Android/iOS) omit. We narrow via `unknown` since
  // CRI only needs `webSocketDebuggerUrl` at runtime.
  const client = (await CDP({
    target: target as unknown as CDP.Target,
    local: true,
  })) as CDP.Client;
  await client.Runtime.enable();
  return {
    client,
    close: async () => {
      await client.close();
    },
  };
}
