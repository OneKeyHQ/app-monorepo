import { JsonRpcException } from "../shared/jsonRpc.js";
import { getBuffers, type ConsoleEntry } from "../adapters/cdpEvents.js";
import type { Registry } from "../daemon/registry.js";

export interface ConsoleTailParams {
  sessionId: string;
  since?: number; // unix ms; return entries with ts >= since
  limit?: number; // max entries to return (default 200, capped at 500)
}

export function consoleTail(
  registry: Registry,
  params: ConsoleTailParams,
): { entries: ConsoleEntry[] } {
  // Verify the session exists — throws -32004 otherwise.
  registry.get(params.sessionId);
  const buf = getBuffers(params.sessionId);
  if (!buf) {
    throw new JsonRpcException(
      -32005,
      "session has no CDP attached — call js.eval at least once first",
    );
  }
  const since = params.since ?? 0;
  const limit = Math.max(1, Math.min(params.limit ?? 200, 500));
  const filtered = buf.console.filter((e) => e.ts >= since);
  return { entries: filtered.slice(-limit) };
}
