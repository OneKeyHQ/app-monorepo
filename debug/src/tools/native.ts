import { FridaAdapter, type FridaEvent } from "../adapters/frida.js";
import type { Registry } from "../daemon/registry.js";
import { JsonRpcException } from "../shared/jsonRpc.js";

function fridaFor(registry: Registry, sessionId: string): FridaAdapter {
  const s = registry.get(sessionId);
  const a = s.adapters.get("frida");
  if (!(a instanceof FridaAdapter)) {
    throw new JsonRpcException(
      -32020,
      "frida adapter not attached to session",
    );
  }
  if (!a.isConnected()) {
    throw new JsonRpcException(
      -32021,
      "frida adapter present but not connected — check session.status",
    );
  }
  return a;
}

export async function nativeCall(
  r: Registry,
  p: { sessionId: string; selector: string; args?: unknown[] },
): Promise<{ result: unknown }> {
  const f = fridaFor(r, p.sessionId);
  return { result: await f.call(p.selector, p.args ?? []) };
}

export async function nativeHook(
  r: Registry,
  p: { sessionId: string; method: string },
): Promise<{ hookId: number }> {
  const f = fridaFor(r, p.sessionId);
  return { hookId: await f.hook(p.method) };
}

export async function nativeUnhook(
  r: Registry,
  p: { sessionId: string; hookId: number },
): Promise<{ removed: boolean }> {
  const f = fridaFor(r, p.sessionId);
  return { removed: await f.unhook(p.hookId) };
}

export async function nativeListHooks(
  r: Registry,
  p: { sessionId: string },
): Promise<{ hooks: Array<{ id: number; method: string }> }> {
  const f = fridaFor(r, p.sessionId);
  return { hooks: await f.listHooks() };
}

export function nativeEvents(
  r: Registry,
  p: { sessionId: string; max?: number },
): { events: FridaEvent[] } {
  const f = fridaFor(r, p.sessionId);
  return { events: f.drainEvents(p.max ?? 100) };
}

export async function nativeScriptRun(
  r: Registry,
  p: { sessionId: string; source: string },
): Promise<unknown> {
  const f = fridaFor(r, p.sessionId);
  return await f.runScript(p.source);
}
