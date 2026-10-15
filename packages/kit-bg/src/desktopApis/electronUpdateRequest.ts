import { net } from 'electron';

import {
  EUpdateErrorCode,
  createUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

import { classifyNodeError, stripSensitiveHeaders } from './nodeDownload';

import type { IncomingHttpHeaders } from 'http';
import type { Readable } from 'stream';

const MAX_REDIRECTS = 5;
const electronNetErrors: Record<string, EUpdateErrorCode> = {
  'net::ERR_NAME_NOT_RESOLVED': EUpdateErrorCode.networkError,
  'net::ERR_INTERNET_DISCONNECTED': EUpdateErrorCode.networkError,
  'net::ERR_CONNECTION_RESET': EUpdateErrorCode.networkError,
  'net::ERR_CONNECTION_REFUSED': EUpdateErrorCode.networkError,
  'net::ERR_NETWORK_CHANGED': EUpdateErrorCode.networkError,
  'net::ERR_TIMED_OUT': EUpdateErrorCode.timeout,
  'net::ERR_CONNECTION_TIMED_OUT': EUpdateErrorCode.timeout,
  'net::ERR_CERT_DATE_INVALID': EUpdateErrorCode.securityRejected,
  'net::ERR_CERT_AUTHORITY_INVALID': EUpdateErrorCode.securityRejected,
  'net::ERR_CERT_COMMON_NAME_INVALID': EUpdateErrorCode.securityRejected,
  'net::ERR_SSL_PROTOCOL_ERROR': EUpdateErrorCode.securityRejected,
};

function classifyElectronRequestError(error: Error) {
  const code = Object.prototype.hasOwnProperty.call(
    electronNetErrors,
    error.message,
  )
    ? electronNetErrors[error.message]
    : undefined;
  return code
    ? createUpdateError({ code, step: 'download' })
    : classifyNodeError(error);
}

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

export async function requestUpdateUrl(
  inputUrl: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
  stallMs = 60_000,
): Promise<IUpdateResponse> {
  let url = inputUrl;
  let requestHeaders = headers;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (signal?.aborted)
      throw createUpdateError({
        code: EUpdateErrorCode.cancelled,
        step: 'download',
      });
    if (new URL(url).protocol !== 'https:') {
      throw createUpdateError({
        code: EUpdateErrorCode.securityRejected,
        step: 'download',
      });
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
      let onAbort = () => {};
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const abortRequest = () => {
        if (!aborted) {
          aborted = true;
          request.abort();
        }
      };
      const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const error = createUpdateError({
            code: EUpdateErrorCode.timeout,
            step: 'download',
          });
          cleanup();
          stream?.destroy(error);
          abortRequest();
          if (!settled) reject(error);
        }, stallMs);
      };
      onAbort = () => {
        const error = createUpdateError({
          code: EUpdateErrorCode.cancelled,
          step: 'download',
        });
        cleanup();
        stream?.destroy(error);
        abortRequest();
        if (!settled) reject(error);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      request.on('error', (error) => {
        cleanup();
        const safeError = classifyElectronRequestError(error);
        if (!settled) reject(safeError);
        else stream?.destroy(safeError);
      });
      request.on('redirect', (_status, _method, redirectUrl) => {
        settled = true;
        cleanup();
        abortRequest();
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
          response.destroy(
            createUpdateError({
              code: EUpdateErrorCode.networkError,
              step: 'download',
            }),
          );
        });
        resetTimer();
        resolve({ response, url: currentUrl });
      });
      if (
        !Object.keys(currentHeaders).some(
          (name) => name.toLowerCase() === 'cache-control',
        )
      ) {
        request.setHeader('Cache-Control', 'no-cache');
      }
      Object.entries(currentHeaders).forEach(([name, value]) =>
        request.setHeader(name, value),
      );
      resetTimer();
      request.end();
    });
    if ('response' in outcome) return outcome;
    const next = new URL(outcome.redirectUrl, url);
    if (next.protocol !== 'https:') {
      throw createUpdateError({
        code: EUpdateErrorCode.securityRejected,
        step: 'download',
      });
    }
    requestHeaders =
      next.origin === new URL(url).origin
        ? requestHeaders
        : stripSensitiveHeaders(requestHeaders);
    url = next.toString();
  }
  throw createUpdateError({
    code: EUpdateErrorCode.securityRejected,
    step: 'download',
  });
}
