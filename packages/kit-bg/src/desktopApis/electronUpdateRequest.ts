import { net } from 'electron';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IncomingHttpHeaders } from 'http';
import type { Readable } from 'stream';

const MAX_REDIRECTS = 5;

export interface IUpdateResponse {
  response: {
    statusCode?: number;
    headers: IncomingHttpHeaders;
    resume: () => void;
    destroy: (error?: Error) => void;
    [Symbol.asyncIterator]: () => AsyncIterator<Buffer>;
  };
  url: string;
}

function stripSensitiveHeaders(headers: Record<string, string>) {
  const allowed = new Set([
    'user-agent',
    'accept',
    'accept-encoding',
    'range',
    'if-range',
  ]);
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => allowed.has(name.toLowerCase())),
  );
}

export async function requestUpdateUrl(
  inputUrl: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
  stallMs = 60_000,
): Promise<IUpdateResponse> {
  let url = inputUrl;
  let requestHeaders = headers;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (signal?.aborted) throw new OneKeyLocalError('Download cancelled');
    if (new URL(url).protocol !== 'https:') {
      throw new OneKeyLocalError('App update request must use HTTPS');
    }
    const currentUrl = url;
    const currentHeaders = requestHeaders;
    const outcome = await new Promise<
      IUpdateResponse | { redirectUrl: string }
    >((resolve, reject) => {
      const request = net.request({ url: currentUrl, redirect: 'manual' });
      let settled = false;
      let stream: IUpdateResponse['response'] | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let aborted = false;
      const abortRequest = () => {
        if (!aborted) {
          aborted = true;
          request.abort();
        }
      };
      const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const error = new OneKeyLocalError('Download timeout');
          stream?.destroy(error);
          abortRequest();
          if (!settled) reject(error);
        }, stallMs);
      };
      const onAbort = () => {
        const error = new OneKeyLocalError('Download cancelled');
        stream?.destroy(error);
        abortRequest();
        if (!settled) reject(error);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      request.on('error', (error) => {
        cleanup();
        if (!settled) reject(error);
        else stream?.destroy(error);
      });
      request.on('redirect', (_status, _method, redirectUrl) => {
        settled = true;
        cleanup();
        // Electron 43 cancels a manual redirect; restart after validating its URL.
        resolve({ redirectUrl });
      });
      request.on('response', (incoming) => {
        settled = true;
        // Electron's IncomingMessage is a Node readable at runtime, although
        // its published type only describes the EventEmitter surface.
        const source = incoming as unknown as Readable;
        const response: IUpdateResponse['response'] = {
          statusCode: incoming.statusCode,
          headers: incoming.headers,
          resume: () => {
            source.resume();
          },
          destroy: (error?: Error) => {
            cleanup();
            source.destroy(error);
            abortRequest();
          },
          async *[Symbol.asyncIterator]() {
            try {
              for await (const chunk of source) {
                resetTimer();
                yield chunk as Buffer;
              }
            } finally {
              cleanup();
            }
          },
        };
        stream = response;
        incoming.once('end', () => {
          cleanup();
        });
        incoming.once('error', () => {
          cleanup();
        });
        incoming.once('aborted', () => {
          cleanup();
          response.destroy(new OneKeyLocalError('Download interrupted'));
        });
        resetTimer();
        resolve({ response, url: currentUrl });
      });
      Object.entries(currentHeaders).forEach(([name, value]) =>
        request.setHeader(name, value),
      );
      resetTimer();
      request.end();
    });
    if ('response' in outcome) return outcome;
    const next = new URL(outcome.redirectUrl, url);
    if (next.protocol !== 'https:') {
      throw new OneKeyLocalError('App update redirect must use HTTPS');
    }
    requestHeaders =
      next.origin === new URL(url).origin
        ? requestHeaders
        : stripSensitiveHeaders(requestHeaders);
    url = next.toString();
  }
  throw new OneKeyLocalError('Too many update redirects');
}
