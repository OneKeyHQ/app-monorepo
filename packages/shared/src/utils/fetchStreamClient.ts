import { OneKeyLocalError } from '../errors';

import bufferUtils from './bufferUtils';

import type {
  IFetchStreamRequester,
  IFetchStreamResult,
} from '../../types/fetchStream';

/** Adapt the JSON bridge to Fetch without replacing the Worker's global fetch. */
export function createFetchStream(
  requester: IFetchStreamRequester,
): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const { signal } = request;
    if (signal.aborted)
      throw new DOMException('Fetch request aborted', 'AbortError');
    let id: string | undefined;
    function detach() {
      signal.removeEventListener('abort', onAbort);
    }
    const cancel = async () => {
      detach();
      if (id) {
        const streamId = id;
        id = undefined;
        await requester({ action: 'cancel', id: streamId });
      }
    };
    function onAbort() {
      void cancel().catch(() => undefined);
    }
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const b64 = request.body
        ? bufferUtils.bytesToBase64(new Uint8Array(await request.arrayBuffer()))
        : undefined;
      if (signal.aborted)
        throw new DOMException('Fetch request aborted', 'AbortError');
      const opening = requester({
        action: 'open',
        url: request.url,
        method: request.method,
        headers: Array.from(request.headers.entries()),
        b64,
      });
      // Cancel promptly while waiting for headers, then release any late handle.
      const result = await new Promise<IFetchStreamResult>(
        (resolve, reject) => {
          const onOpenAbort = () =>
            reject(new DOMException('Fetch request aborted', 'AbortError'));
          signal.addEventListener('abort', onOpenAbort, { once: true });
          void opening.then(
            (reply) => {
              signal.removeEventListener('abort', onOpenAbort);
              if (signal.aborted) {
                if (reply.ok && 'response' in reply) {
                  void requester({
                    action: 'cancel',
                    id: reply.response.id,
                  }).catch(() => undefined);
                }
                onOpenAbort();
              } else resolve(reply);
            },
            (error) => {
              signal.removeEventListener('abort', onOpenAbort);
              reject(error);
            },
          );
          if (signal.aborted) onOpenAbort();
        },
      );
      if (!result.ok) throw new OneKeyLocalError(result.error);
      if (!('response' in result)) {
        throw new OneKeyLocalError('invalid fetch stream response');
      }
      id = result.response.id;
      if (signal.aborted)
        throw new DOMException('Fetch request aborted', 'AbortError');
      if (
        request.method === 'HEAD' ||
        [204, 205, 304].includes(result.response.status)
      ) {
        await cancel();
        return new Response(null, result.response);
      }
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            if (signal.aborted)
              throw new DOMException('Fetch request aborted', 'AbortError');
            if (!id) throw new OneKeyLocalError('fetch stream cancelled');
            const chunk = await requester({ action: 'read', id });
            if (signal.aborted)
              throw new DOMException('Fetch request aborted', 'AbortError');
            if (!chunk.ok) throw new OneKeyLocalError(chunk.error);
            if (!('chunk' in chunk)) {
              throw new OneKeyLocalError('invalid fetch stream chunk');
            }
            if (chunk.chunk.done) {
              signal.removeEventListener('abort', onAbort);
              id = undefined;
              controller.close();
            } else {
              controller.enqueue(
                new Uint8Array(bufferUtils.base64ToBytes(chunk.chunk.b64)),
              );
            }
          } catch (error) {
            controller.error(error);
            await cancel().catch(() => undefined);
          }
        },
        cancel,
      });
      return new Response(stream, {
        status: result.response.status,
        statusText: result.response.statusText,
        headers: result.response.headers,
      });
    } catch (error) {
      await cancel().catch(() => undefined);
      throw error;
    }
  };
}
