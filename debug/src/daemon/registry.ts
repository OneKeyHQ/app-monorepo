import { JsonRpcException } from "../shared/jsonRpc.js";
import {
  Session,
  type Platform,
  type SessionSummary,
} from "./session.js";

interface AttachParams {
  platform: string;
  deviceId: string;
  appBundle?: string;
}

interface SessionIdParams {
  sessionId: string;
}

const SUPPORTED_PLATFORMS: ReadonlySet<string> = new Set(["ios", "android"]);

export class Registry {
  private readonly sessions = new Map<string, Session>();

  async attach(params: AttachParams): Promise<SessionSummary> {
    if (!SUPPORTED_PLATFORMS.has(params.platform)) {
      throw new JsonRpcException(
        -32602,
        `unsupported platform: ${params.platform}`,
      );
    }
    const session = new Session(
      params.platform as Platform,
      params.deviceId,
      params.appBundle ?? "com.onekey.wallet",
    );
    await session.attachAll();
    this.sessions.set(session.id, session);
    return session.toSummary();
  }

  async detach(params: SessionIdParams): Promise<{ detached: string }> {
    const s = this.require(params.sessionId);
    await s.detachAll();
    this.sessions.delete(s.id);
    return { detached: s.id };
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()].map((s) => s.toSummary());
  }

  async status(
    params: SessionIdParams,
  ): Promise<SessionSummary & { adapters: Record<string, unknown> }> {
    const s = this.require(params.sessionId);
    return { ...s.toSummary(), adapters: await s.health() };
  }

  get(id: string): Session {
    return this.require(id);
  }

  private require(id: string): Session {
    const s = this.sessions.get(id);
    if (!s) {
      throw new JsonRpcException(-32004, `session not found: ${id}`);
    }
    return s;
  }
}
