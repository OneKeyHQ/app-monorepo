import { createConnection } from "node:net";

export const DEFAULT_SOCKET =
  process.env.ODB_SOCKET ?? "/tmp/onekey-debug-bridge.sock";

export class RpcClientError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message);
    this.name = "RpcClientError";
  }
}

export async function call(
  method: string,
  params: Record<string, unknown> = {},
  socketPath: string = DEFAULT_SOCKET,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const c = createConnection(socketPath);
    let buf = "";
    c.on("connect", () => {
      c.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) + "\n");
    });
    c.on("data", (b) => {
      buf += b.toString();
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      try {
        const resp = JSON.parse(buf.slice(0, nl));
        c.end();
        if ("error" in resp) {
          reject(
            new RpcClientError(
              `[${resp.error.code}] ${resp.error.message}`,
              resp.error.code,
            ),
          );
          return;
        }
        resolve(resp.result);
      } catch (e) {
        c.end();
        reject(e);
      }
    });
    c.on("error", (e) => {
      reject(
        new RpcClientError(
          `daemon not reachable at ${socketPath}: ${e.message} — start with \`yarn dev:native-debug-bridge\``,
        ),
      );
    });
  });
}
