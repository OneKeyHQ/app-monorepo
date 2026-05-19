import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { execa } from "execa";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const ROOT = path.resolve(import.meta.dirname, "..");
let daemon: ChildProcess;
let dir: string;
let socket: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "odb-cli-"));
  socket = path.join(dir, "cli.sock");
  daemon = spawn(
    "node",
    [
      path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(ROOT, "src", "daemon", "main.ts"),
    ],
    {
      env: { ...process.env, ODB_SOCKET: socket },
      stdio: "ignore",
      cwd: ROOT,
    },
  );
  for (let i = 0; i < 80; i++) {
    if (existsSync(socket)) break;
    await wait(100);
  }
  if (!existsSync(socket)) {
    daemon.kill();
    throw new Error("daemon socket never appeared");
  }
}, 15000);

afterAll(async () => {
  daemon.kill();
  // give the daemon a moment to clean up its socket
  await wait(200);
  rmSync(dir, { recursive: true, force: true });
});

async function odb(...args: string[]) {
  return execa(
    "node",
    [
      path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(ROOT, "src", "cli", "main.ts"),
      ...args,
    ],
    {
      env: { ...process.env, ODB_SOCKET: socket },
      cwd: ROOT,
      reject: false,
    },
  );
}

describe("odb CLI", () => {
  it("daemon status returns pong", async () => {
    const r = await odb("daemon", "status");
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("pong");
  });

  it("session attach + list + detach round-trip", async () => {
    const a = await odb("session", "attach", "-p", "ios", "-d", "booted");
    expect(a.exitCode).toBe(0);
    const summary = JSON.parse(a.stdout);
    expect(summary.id).toMatch(/^S-/);

    const l = await odb("session", "list");
    expect(l.exitCode).toBe(0);
    expect(l.stdout).toContain(summary.id);

    const d = await odb("session", "detach", summary.id);
    expect(d.exitCode).toBe(0);
    expect(d.stdout).toContain("detached");
  });

  it("reports error on unknown session detach", async () => {
    const r = await odb("session", "detach", "S-nope");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("session not found");
  });
});
