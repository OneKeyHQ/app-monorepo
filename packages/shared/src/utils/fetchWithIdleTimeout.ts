import { OneKeyLocalError } from '../errors';

/**
 * How long a node response may go without delivering a single byte.
 *
 * A total-duration limit kills a large response that is arriving slowly but
 * steadily: through a proxy or on a congested link, a batch of Monero blocks
 * (up to ~15 MB, wallet2's batch size) can take minutes and still be fine.
 * Only silence means the connection is gone.
 */
export const FETCH_REQUEST_IDLE_TIMEOUT_MS = 30_000;

// Match the Monero runtime's cap before allocating or crossing a host bridge.
export const FETCH_RESPONSE_MAX_BYTES = 32 * 1024 * 1024;

/**
 * POST (or any fetch) and read the whole body, failing only when the transfer
 * stalls for `idleMs` -- counted from the request and again from every chunk
 * that arrives. Works in browsers, extension service workers and Node 18+.
 */
export async function fetchBytesWithIdleTimeout(
  url: string,
  init: RequestInit,
  idleMs: number = FETCH_REQUEST_IDLE_TIMEOUT_MS,
  // Electron's main process passes `net.fetch` so the request follows the
  // same (system) proxy as the app's other traffic; Node's fetch ignores it.
  fetchImpl: typeof fetch = fetch,
  maxBytes = FETCH_RESPONSE_MAX_BYTES,
): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  bytes: Uint8Array;
}> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const onAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', onAbort, { once: true });
  if (init.signal?.aborted) onAbort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort(
        new OneKeyLocalError(`no data from the node for ${idleMs} ms`),
      );
    }, idleMs);
  };
  arm();
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    arm();
    const meta = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
    if (!response.ok) return { ...meta, bytes: new Uint8Array() };
    if (Number(response.headers?.get('content-length')) > maxBytes) {
      throw new OneKeyLocalError('node response exceeds size limit');
    }
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxBytes) {
        throw new OneKeyLocalError('node response exceeds size limit');
      }
      return { ...meta, bytes };
    }
    reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      arm();
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel?.().catch(() => undefined);
        throw new OneKeyLocalError('node response exceeds size limit');
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return { ...meta, bytes };
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
    // Also cancel host streams when a caller aborts or the size cap is reached.
    controller.abort();
    reader?.releaseLock?.();
  }
}
