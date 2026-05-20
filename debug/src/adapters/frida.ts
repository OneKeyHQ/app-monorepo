import frida from "frida";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Adapter, type AdapterHealth } from "./base.js";

const AGENT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "agents",
  "agent.js",
);

export interface FridaEvent {
  id: number;
  kind: "enter" | "leave" | "log";
  method: string;
  ts: number;
  retval?: string;
}

// frida-node 16.x's type surface is large; the call sites below narrow with
// `unknown` + structural use because the published `Device`/`Session`/`Script`
// types are class symbols (not interfaces) and pull in nominal generics that
// add little signal here.
interface FridaApplication {
  identifier: string;
  pid: number;
  name?: string;
}

interface FridaScriptHandle {
  load(): Promise<void>;
  unload(): Promise<void>;
  message: { connect(handler: (message: unknown, data: unknown) => void): void };
  exports: Record<string, (...args: unknown[]) => unknown>;
}

interface FridaSessionHandle {
  createScript(source: string): Promise<FridaScriptHandle>;
  detach(): Promise<void>;
}

interface FridaDeviceHandle {
  id: string;
  type: string;
  enumerateApplications(): Promise<FridaApplication[]>;
  attach(pid: number): Promise<FridaSessionHandle>;
}

// Surface used from frida's default export. Kept structural so a vi.mock'd
// frida module can substitute without the test having to know about Signal,
// DeviceType, etc.
interface FridaModuleLike {
  getUsbDevice(opts?: { timeout?: number }): Promise<FridaDeviceHandle>;
  getDeviceManager(): {
    enumerateDevices(): Promise<FridaDeviceHandle[]>;
  };
  getLocalDevice?(): Promise<FridaDeviceHandle>;
}

const fridaModule = frida as unknown as FridaModuleLike;

export class FridaAdapter extends Adapter {
  readonly name = "frida";
  private session: FridaSessionHandle | null = null;
  private script: FridaScriptHandle | null = null;
  private rpcExports: Record<string, (...args: unknown[]) => unknown> | null =
    null;
  private events: FridaEvent[] = [];
  private connected = false;
  private detail: string | undefined = undefined;

  constructor(
    readonly platform: "ios" | "android",
    private readonly deviceId: string,
    private readonly appBundle: string,
  ) {
    super();
  }

  async attach(): Promise<void> {
    // Short-circuit under vitest: when the frida module isn't mocked, the
    // real `getUsbDevice` would wait 5s before rejecting on machines with
    // no paired device. Tests that need Frida behavior already vi.mock("frida").
    if (process.env.VITEST && !process.env.ODB_FRIDA_REAL) {
      // Distinguish "mocked frida is in play" from "we're in vitest with the
      // real module": if `getDeviceManager` isn't a function, vi.mock is
      // active and we should proceed normally.
      type MaybeMocked = { getDeviceManager?: unknown };
      const looksMocked =
        typeof (fridaModule as unknown as MaybeMocked).getDeviceManager ===
        "function" &&
        // Mocked modules tag with `_isMockFunction` on inner properties via vitest
        Object.prototype.hasOwnProperty.call(
          (fridaModule as unknown as { getUsbDevice?: unknown })
            .getUsbDevice ?? {},
          "mock",
        );
      if (!looksMocked) {
        this.connected = false;
        this.detail = "skipped: VITEST without ODB_FRIDA_REAL";
        return;
      }
    }
    try {
      // Multi-device safety: prefer the device whose id matches the session's
      // deviceId so two concurrent sessions on different USB devices don't
      // both end up attached to whichever device `getUsbDevice()` returns
      // first. If no exact match (e.g. tests using "booted" as a sentinel
      // for the active simulator), fall back to the existing USB-then-any
      // heuristic so single-device flows still work unchanged.
      const devs = await fridaModule
        .getDeviceManager()
        .enumerateDevices()
        .catch(() => [] as FridaDeviceHandle[]);
      const exactMatch = devs.find((d) => d.id === this.deviceId);
      let device: FridaDeviceHandle | undefined;
      if (exactMatch) {
        device = exactMatch;
      } else {
        device = await fridaModule
          .getUsbDevice({ timeout: 1_000 })
          .catch(async () => {
            const pick =
              devs.find((d) => d.type !== "remote" && d.id !== "social") ??
              devs[0];
            return pick;
          });
      }
      if (!device) throw new Error("no frida device available");
      const apps = await device.enumerateApplications();
      const app = apps.find((a) => a.identifier === this.appBundle);
      if (!app || !app.pid) {
        throw new Error(
          `app ${this.appBundle} is not running on device ${this.deviceId}`,
        );
      }

      this.session = await device.attach(app.pid);
      const source = readFileSync(AGENT_PATH, "utf8");
      this.script = await this.session.createScript(source);

      // Surface async send() emits from the agent — hook fires arrive here.
      this.script.message.connect((message: unknown) => {
        const m = message as {
          type?: string;
          payload?: { kind?: string; evt?: FridaEvent };
        };
        if (
          m &&
          m.type === "send" &&
          m.payload &&
          m.payload.kind === "event" &&
          m.payload.evt
        ) {
          this.events.push(m.payload.evt);
          if (this.events.length > 1000) this.events.shift();
        }
      });

      await this.script.load();
      this.rpcExports = this.script.exports;
      this.connected = true;
      this.detail = `pid=${app.pid}`;
    } catch (e) {
      this.connected = false;
      this.detail = (e as Error).message;
      // Adapter attach is best-effort; surface failure via health() rather
      // than throwing so the session as a whole can still be created.
    }
  }

  async detach(): Promise<void> {
    try {
      await this.script?.unload();
    } catch {
      /* ignore */
    }
    try {
      await this.session?.detach();
    } catch {
      /* ignore */
    }
    this.script = null;
    this.session = null;
    this.rpcExports = null;
    this.connected = false;
  }

  async health(): Promise<AdapterHealth> {
    return { name: "frida", connected: this.connected, detail: this.detail };
  }

  isConnected(): boolean {
    return this.connected && this.rpcExports !== null;
  }

  private exports(): Record<string, (...args: unknown[]) => unknown> {
    if (!this.rpcExports) {
      throw new Error(`frida not attached: ${this.detail ?? "unknown reason"}`);
    }
    return this.rpcExports;
  }

  async call(selector: string, args: unknown[] = []): Promise<unknown> {
    return await this.exports().call(selector, args);
  }

  async hook(method: string): Promise<number> {
    return (await this.exports().hook(method, {})) as number;
  }

  async unhook(id: number): Promise<boolean> {
    return (await this.exports().unhook(id)) as boolean;
  }

  async listHooks(): Promise<Array<{ id: number; method: string }>> {
    return (await this.exports().listHooks()) as Array<{
      id: number;
      method: string;
    }>;
  }

  async runScript(source: string): Promise<unknown> {
    return await this.exports().runScript(source);
  }

  async memoryClasses(
    top = 20,
  ): Promise<Array<{ name: string; count: number; rss_kb: number }>> {
    return (await this.exports().memoryClasses(top)) as Array<{
      name: string;
      count: number;
      rss_kb: number;
    }>;
  }

  drainEvents(max = 100): FridaEvent[] {
    return this.events.splice(0, Math.min(max, this.events.length));
  }
}
