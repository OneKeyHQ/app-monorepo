import { createServer, type Server, type Socket } from "node:net";
import { promises as fs } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { pino } from "pino";
import type { Dispatcher } from "./dispatcher.js";

const log = pino({ name: "daemon" });

// Per-connection guard: drop a client that sends a single line larger than
// this without a terminating newline. Tool responses can be large, but the
// inbound request side should never legitimately approach 1 MB.
const MAX_LINE_BYTES = 1_048_576;

export class UnixSocketServer {
  private server: Server | null = null;

  constructor(
    public readonly socketPath: string,
    private readonly dispatcher: Dispatcher,
  ) {}

  async start(): Promise<void> {
    if (this.server !== null) {
      throw new Error("UnixSocketServer.start: already started");
    }
    await fs.mkdir(path.dirname(this.socketPath), { recursive: true });
    try {
      await fs.unlink(this.socketPath);
    } catch {
      // socket may not exist; ignore
    }

    const server = createServer((socket) => this.handleClient(socket));
    this.server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(this.socketPath, () => resolve());
      });
      await fs.chmod(this.socketPath, 0o700);
    } catch (e) {
      // Partial start: ensure the instance can be reused after the caller
      // handles the error. Close any half-listening server, drop the ref.
      this.server = null;
      try {
        await new Promise<void>((res) => server.close(() => res()));
      } catch {
        // best effort
      }
      throw e;
    }
    log.info({ socket: this.socketPath }, "daemon listening");
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((res) => this.server!.close(() => res()));
      this.server = null;
    }
    try {
      await fs.unlink(this.socketPath);
    } catch {
      // already removed
    }
  }

  private handleClient(socket: Socket): void {
    let buf = "";
    socket.on("data", async (chunk) => {
      buf += chunk.toString();
      if (buf.length > MAX_LINE_BYTES && buf.indexOf("\n") === -1) {
        // Refuse to keep buffering an unbounded line.
        const resp = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error: line too long",
          },
        };
        buf = "";
        if (socket.writable) {
          // Use end() so the response is flushed before FIN, instead of
          // destroy() which would drop the pending write.
          socket.end(JSON.stringify(resp) + "\n");
        } else {
          socket.destroy();
        }
        return;
      }
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let resp;
        try {
          const req = JSON.parse(line);
          resp = await this.dispatcher.handle(req);
        } catch (e) {
          resp = {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: `Parse error: ${(e as Error).message}`,
            },
          };
        }
        if (!socket.writable) {
          // Client closed mid-handler; abandon remaining lines for this
          // connection rather than throwing on a dead socket.
          break;
        }
        const ok = socket.write(JSON.stringify(resp) + "\n");
        if (!ok) {
          // Respect kernel back-pressure for large payloads (screenshots,
          // ui.tree). Wait for the drain before pulling the next request.
          try {
            await once(socket, "drain");
          } catch {
            // Socket errored while waiting; loop will exit via writable check.
            break;
          }
        }
      }
    });
    socket.on("error", (e) => log.warn({ err: e }, "client error"));
    socket.on("end", () => {
      // Half-close from the client side: drain our side cleanly.
      socket.end();
    });
    socket.on("close", (hadError) => {
      log.debug({ hadError }, "client disconnected");
    });
  }
}
