import { randomBytes } from "node:crypto";
import type { Adapter, AdapterHealth } from "../adapters/base.js";

export type Platform = "ios" | "android";

export interface SessionSummary {
  id: string;
  platform: Platform;
  deviceId: string;
  appBundle: string;
}

export class Session {
  readonly id: string;
  readonly adapters = new Map<string, Adapter>();

  constructor(
    readonly platform: Platform,
    readonly deviceId: string,
    readonly appBundle: string,
  ) {
    this.id = "S-" + randomBytes(4).toString("hex");
  }

  async attachAll(): Promise<void> {
    for (const a of this.adapters.values()) await a.attach();
  }

  async detachAll(): Promise<void> {
    for (const a of this.adapters.values()) await a.detach();
  }

  async health(): Promise<Record<string, AdapterHealth>> {
    const out: Record<string, AdapterHealth> = {};
    for (const [name, a] of this.adapters) out[name] = await a.health();
    return out;
  }

  toSummary(): SessionSummary {
    return {
      id: this.id,
      platform: this.platform,
      deviceId: this.deviceId,
      appBundle: this.appBundle,
    };
  }
}
