import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { connect } from "node:net";
import { Dispatcher } from "../src/daemon/dispatcher.js";
import { UnixSocketServer } from "../src/daemon/server.js";

let dir: string;
let socketPath: string;
let server: UnixSocketServer;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "odb-test-"));
  socketPath = path.join(dir, "test.sock");
  const d = new Dispatcher();
  d.register("ping", () => ({ pong: true }));
  server = new UnixSocketServer(socketPath, d);
  await server.start();
});

afterEach(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
});

function send(socket: string, payload: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const c = connect(socket);
    let buf = "";
    c.on("data", (b) => {
      buf += b.toString();
    });
    c.on("end", () => resolve(buf));
    c.on("error", reject);
    c.write(JSON.stringify(payload) + "\n");
    // close from our side after writing — server should still respond first
    c.end();
  });
}

describe("UnixSocketServer", () => {
  it("round-trips a ping", async () => {
    const raw = await send(socketPath, {
      jsonrpc: "2.0",
      id: 1,
      method: "ping",
    });
    expect(JSON.parse(raw.trim())).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { pong: true },
    });
  });

  it("rejects parse errors with -32700", async () => {
    const raw = await new Promise<string>((resolve, reject) => {
      const c = connect(socketPath);
      let buf = "";
      c.on("data", (b) => {
        buf += b.toString();
      });
      c.on("end", () => resolve(buf));
      c.on("error", reject);
      c.write("not json\n");
      c.end();
    });
    expect(raw).toContain("-32700");
  });
});
