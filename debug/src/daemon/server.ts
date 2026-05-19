import { createServer, type Server, type Socket } from "node:net";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pino } from "pino";
import type { Dispatcher } from "./dispatcher.js";

const log = pino({ name: "daemon" });

export class UnixSocketServer {
  private server: Server | null = null;

  constructor(
    public readonly socketPath: string,
    private readonly dispatcher: Dispatcher,
  ) {}

  async start(): Promise<void> {
    await fs.mkdir(path.dirname(this.socketPath), { recursive: true });
    try {
      await fs.unlink(this.socketPath);
    } catch {
      // socket may not exist; ignore
    }

    this.server = createServer((socket) => this.handleClient(socket));
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.socketPath, () => resolve());
    });
    await fs.chmod(this.socketPath, 0o700);
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
        socket.write(JSON.stringify(resp) + "\n");
      }
    });
    socket.on("error", (e) => log.warn({ err: e }, "client error"));
  }
}
