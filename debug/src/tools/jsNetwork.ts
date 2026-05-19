import { JsonRpcException } from "../shared/jsonRpc.js";
import {
  fetchBody,
  getBuffers,
  type NetworkEntry,
} from "../adapters/cdpEvents.js";
import type { Registry } from "../daemon/registry.js";

export interface NetworkListParams {
  sessionId: string;
  since?: number;
  limit?: number;
}

export function networkList(
  registry: Registry,
  params: NetworkListParams,
): { entries: NetworkEntry[] } {
  registry.get(params.sessionId);
  const buf = getBuffers(params.sessionId);
  if (!buf) {
    throw new JsonRpcException(
      -32005,
      "session has no CDP attached — call js.eval at least once first",
    );
  }
  const since = params.since ?? 0;
  const limit = Math.max(1, Math.min(params.limit ?? 100, 500));
  const all = [...buf.network.values()]
    .filter((e) => e.startedAt >= since)
    .sort((a, b) => a.startedAt - b.startedAt);
  return { entries: all.slice(-limit) };
}

export interface NetworkBodyParams {
  sessionId: string;
  requestId: string;
}

export async function networkBody(
  registry: Registry,
  params: NetworkBodyParams,
): Promise<{ body: string; base64Encoded: boolean }> {
  registry.get(params.sessionId);
  const r = await fetchBody(params.sessionId, params.requestId);
  if (!r) {
    throw new JsonRpcException(
      -32006,
      `body not available for ${params.requestId}`,
    );
  }
  return r;
}
