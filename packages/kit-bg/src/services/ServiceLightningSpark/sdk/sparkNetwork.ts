import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

// Network policy of the Breez SDK Spark web build. A bundler loader binds the
// free `fetch` and `WebSocket` of the SDK's wasm glue to the exports below
// (development/rspack/loaders/breezSdkSparkNetworkLoader.js), so every request
// the SDK makes comes here. Requests to a known upstream go out directly; any
// other destination is refused, so an SDK upgrade cannot add traffic to a new
// host.

// SDK upstreams by origin, named for the log. The Spark operators and the
// Breez services carry the Spark protocol; the Lightspark SSP serves the
// Lightning business (invoices, Lightning payments and swaps).
const SPARK_UPSTREAMS: Record<string, string> = {
  'https://0.spark.lightspark.com': 'operator-lightspark',
  'https://spark-operator.breez.technology': 'operator-breez',
  'https://2.spark.flashnet.xyz': 'operator-flashnet',
  'https://datasync.breez.technology:442': 'breez-datasync',
  'https://nd1.breez.technology': 'breez-auth',
  'https://api.lightspark.com': 'ssp',
};

// The glue also fetches the SDK's own wasm binary at init.
const BREEZ_WASM_PATH = /breez_sdk_spark_wasm_bg(\.[0-9a-f]+)?\.wasm$/;

export function getSparkUpstream(url: string): string | undefined {
  return SPARK_UPSTREAMS[new URL(url).origin];
}

export async function sparkFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  const { host, pathname } = new URL(request.url);
  if (BREEZ_WASM_PATH.test(pathname)) {
    return globalThis.fetch(input, init);
  }
  const { method } = request;
  const upstream = getSparkUpstream(request.url);
  if (!upstream) {
    defaultLogger.lightning.spark.requestBlocked({
      method,
      host,
      path: pathname,
    });
    throw new OneKeyLocalError(`Lightning Spark request blocked: ${host}`);
  }

  const startedAt = Date.now();
  const trail = { method, upstream, path: pathname };
  let response: Response;
  try {
    // Headers go in the options as a plain object: the global fetch wrapper
    // reads them there to leave gRPC-web streams unread.
    response = await globalThis.fetch(request.url, {
      method,
      headers: Object.fromEntries(request.headers.entries()),
      body: ['GET', 'HEAD'].includes(method)
        ? undefined
        : await request.arrayBuffer(),
      signal: request.signal,
      // A redirect could take the SDK to a host outside the list above.
      redirect: 'error',
    });
  } catch (error) {
    // An abort is the SDK cancelling its own call, e.g. closing a stream.
    if (!request.signal.aborted) {
      defaultLogger.lightning.spark.requestFailed({
        ...trail,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      });
    }
    throw error;
  }

  // gRPC errors that arrive before any message come as a header.
  const grpcStatus = response.headers.get('grpc-status') ?? undefined;
  if (!response.ok || (grpcStatus && grpcStatus !== '0')) {
    defaultLogger.lightning.spark.requestFailed({
      ...trail,
      status: response.status,
      grpcStatus,
      durationMs: Date.now() - startedAt,
    });
  } else {
    defaultLogger.lightning.spark.requestSent({
      ...trail,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
  }
  return response;
}

// Only the SDK's passkey login opens WebSockets, and OneKey does not use it.
export class SparkWebSocket {
  constructor(url: string | URL) {
    const { host, pathname } = new URL(url);
    defaultLogger.lightning.spark.requestBlocked({
      method: 'WEBSOCKET',
      host,
      path: pathname,
    });
    throw new OneKeyLocalError(`Lightning Spark WebSocket blocked: ${host}`);
  }
}
