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

  it("socket file has 0700 perms", async () => {
    const { statSync } = await import("node:fs");
    const mode = statSync(socketPath).mode & 0o777;
    expect(mode).toBe(0o700);
  });

  it("rejects oversized line with -32700 and closes", async () => {
    const { connect } = await import("node:net");
    const chunk = "x".repeat(100_000);
    const raw = await new Promise<string>((resolve) => {
      const c = connect(socketPath);
      let buf = "";
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(buf);
      };
      c.on("data", (b) => {
        buf += b.toString();
        // The server writes the -32700 line then destroys; once we see it
        // we don't need to wait for any further close/error event.
        if (buf.includes("-32700")) {
          c.destroy();
          finish();
        }
      });
      c.on("close", finish);
      // Server destroys the socket mid-stream, which yields EPIPE/ECONNRESET
      // on the client side once the kernel discovers the closed peer. That
      // is part of the expected close path here, not a test failure.
      c.on("error", finish);
      // Write in chunks > 1 MB total so the server's MAX_LINE_BYTES guard
      // trips. Spread writes across event-loop ticks so the server has a
      // chance to read, respond, and destroy before the client write side
      // backs up enough to surface an error.
      let sent = 0;
      const tick = () => {
        if (done) return;
        if (sent >= 1_200_000) return; // > MAX_LINE_BYTES
        if (!c.writable) return;
        c.write(chunk);
        sent += chunk.length;
        setImmediate(tick);
      };
      tick();
    });
    expect(raw).toContain("-32700");
  });

  it("start twice throws", async () => {
    const { Dispatcher } = await import("../src/daemon/dispatcher.js");
    const { UnixSocketServer } = await import("../src/daemon/server.js");
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const d2 = mkdtempSync(path.join(tmpdir(), "odb-twice-"));
    const sp = path.join(d2, "twice.sock");
    const srv = new UnixSocketServer(sp, new Dispatcher());
    await srv.start();
    await expect(srv.start()).rejects.toThrow(/already started/);
    await srv.stop();
    rmSync(d2, { recursive: true, force: true });
  });
});
