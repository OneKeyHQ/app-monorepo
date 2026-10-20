import { OneKeyLocalError } from '../errors';

import bufferUtils from './bufferUtils';
import {
  FETCH_REQUEST_IDLE_TIMEOUT_MS,
  FETCH_RESPONSE_MAX_BYTES,
} from './fetchWithIdleTimeout';
import { generateUUID } from './miscUtils';
import { streamingFetch } from './streamingFetch';

import type { IFetchStreamRequester } from '../../types/fetchStream';

export const FETCH_STREAM_CHUNK_BYTES = 1024 * 1024;
export const FETCH_STREAM_MAX_ACTIVE = 4;

type IFetchStream = {
  controller: AbortController;
  reader?: ReadableStreamDefaultReader<Uint8Array>;
  response?: Response;
  timer?: ReturnType<typeof setTimeout>;
  reading: boolean;
  receivedBytes: number;
  pending?: Uint8Array;
};

/** Pull one chunk per bridge call; abandoned streams expire without a caller. */
export function createFetchStreamHandler(
  fetchImpl: typeof fetch = streamingFetch,
  idleMs = FETCH_REQUEST_IDLE_TIMEOUT_MS,
): IFetchStreamRequester {
  const streams = new Map<string, IFetchStream>();
  const close = (id: string, stream: IFetchStream) => {
    streams.delete(id);
    clearTimeout(stream.timer);
    stream.pending = undefined;
    stream.response = undefined;
    stream.controller.abort();
    void stream.reader?.cancel().catch(() => undefined);
  };
  const arm = (id: string, stream: IFetchStream) => {
    clearTimeout(stream.timer);
    stream.timer = setTimeout(() => close(id, stream), idleMs);
  };

  return async (request) => {
    let id: string | undefined;
    let stream: IFetchStream | undefined;
    try {
      if (request.action === 'open') {
        if (streams.size >= FETCH_STREAM_MAX_ACTIVE) {
          throw new OneKeyLocalError('too many active fetch streams');
        }
        const url = new URL(request.url);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new OneKeyLocalError('unsupported fetch protocol');
        }
        if (url.username || url.password) {
          throw new OneKeyLocalError('fetch URL credentials are not supported');
        }
        const method = (request.method ?? 'GET').toUpperCase();
        if (
          ![
            'GET',
            'HEAD',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
          ].includes(method)
        ) {
          throw new OneKeyLocalError('unsupported fetch method');
        }
        if (
          (method === 'GET' || method === 'HEAD') &&
          request.b64 !== undefined
        ) {
          throw new OneKeyLocalError(
            'fetch GET/HEAD requests cannot have a body',
          );
        }
        const headers = new Headers(request.headers);
        // Page origins and browser credentials must not be forwarded by a relay.
        for (const name of ['origin', 'host', 'cookie', 'referer']) {
          if (headers.has(name)) {
            throw new OneKeyLocalError('unsupported fetch request header');
          }
        }
        // Each host owns its HTTP connection; hop-by-hop headers cannot cross it.
        for (const name of [
          'te',
          'connection',
          'keep-alive',
          'transfer-encoding',
          'upgrade',
          'content-length',
        ]) {
          headers.delete(name);
        }
        id = generateUUID();
        stream = {
          controller: new AbortController(),
          reading: false,
          receivedBytes: 0,
        };
        streams.set(id, stream);
        arm(id, stream);
        // The parsed URL is the one checked above.
        const response = await fetchImpl(url.href, {
          method,
          headers,
          body:
            request.b64 === undefined
              ? undefined
              : new Uint8Array(bufferUtils.base64ToBytes(request.b64)),
          credentials: 'omit',
          // Preserve the chosen endpoint and TLS scheme; redirects need a new URL.
          redirect: 'error',
          signal: stream.controller.signal,
        });
        if (stream.controller.signal.aborted) {
          throw new OneKeyLocalError('fetch request expired');
        }
        if (
          method !== 'HEAD' &&
          Number(response.headers.get('content-length')) >
            FETCH_RESPONSE_MAX_BYTES
        ) {
          throw new OneKeyLocalError('fetch response exceeds size limit');
        }
        stream.reader = response.body?.getReader?.();
        // React Native fetch may expose only arrayBuffer, without a body stream.
        stream.response = stream.reader ? undefined : response;
        arm(id, stream);
        return {
          ok: true,
          response: {
            id,
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()),
          },
        };
      }
      id = request.id;
      stream = streams.get(id);
      if (request.action === 'cancel') {
        if (stream) close(id, stream);
        return { ok: true, cancelled: true };
      }
      if (!stream) throw new OneKeyLocalError('fetch stream expired or closed');
      if (stream.reading) {
        throw new OneKeyLocalError('fetch stream already has a pending read');
      }
      stream.reading = true;
      let chunk: ReadableStreamReadResult<Uint8Array>;
      if (stream.pending) {
        chunk = { done: false, value: stream.pending };
      } else if (stream.reader) {
        chunk = await stream.reader.read();
      } else if (stream.response) {
        chunk = {
          done: false,
          value: new Uint8Array(await stream.response.arrayBuffer()),
        };
      } else {
        chunk = { done: true, value: undefined };
      }
      if (chunk.value && !stream.pending) {
        stream.receivedBytes += chunk.value.byteLength;
        if (stream.receivedBytes > FETCH_RESPONSE_MAX_BYTES) {
          throw new OneKeyLocalError('fetch response exceeds size limit');
        }
      }
      // A native fallback or Chromium reader can deliver a multi-MiB chunk.
      // Bound JSON encoding and every carrier/Worker message independently.
      const bytes = chunk.value?.subarray(0, FETCH_STREAM_CHUNK_BYTES);
      stream.pending =
        chunk.value && chunk.value.byteLength > FETCH_STREAM_CHUNK_BYTES
          ? chunk.value.subarray(FETCH_STREAM_CHUNK_BYTES)
          : undefined;
      stream.reading = false;
      stream.response = undefined;
      if (stream.controller.signal.aborted) {
        throw new OneKeyLocalError('fetch stream expired');
      }
      if (chunk.done) {
        streams.delete(id);
        clearTimeout(stream.timer);
        stream.reader?.releaseLock();
      } else {
        arm(id, stream);
      }
      return {
        ok: true,
        chunk: {
          done: chunk.done === true,
          b64: bytes ? bufferUtils.bytesToBase64(bytes) : '',
        },
      };
    } catch (error) {
      if (id && stream) close(id, stream);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
