import { isNil, isString } from 'lodash';

import { defaultLogger } from '../logger/logger';
import { isEnableLogNetwork } from '../logger/scopes/app/scenes/networkFilter';
import systemTimeUtils from '../utils/systemTimeUtils';

import {
  createApiAvailabilityTiming,
  reportApiAvailabilityError,
  reportApiAvailabilityResponse,
} from './availabilityMetrics';
import { withCustomUAHeaders } from './customUA';
import { HEADER_REQUEST_ID_KEY, getRequestHeaders } from './Interceptor';
import { AVAILABILITY_COUNTED_FETCH_OPTION } from './requestConst';
import requestHelper from './requestHelper';

function getRequestHeader(options: RequestInit, name: string) {
  const headers = options.headers as
    | { get?: (key: string) => string | null; [key: string]: unknown }
    | undefined;
  const value =
    typeof headers?.get === 'function'
      ? headers.get(name)
      : (headers?.[name] ??
        headers?.[name.replace(/(^|-)[a-z]/g, (s) => s.toUpperCase())]);
  return String(value ?? '');
}

// Event streams never end on their own, and a gRPC-web call may be a server
// stream; their owner counts them.
function isStreamingRequest(options: RequestInit) {
  return (
    getRequestHeader(options, 'accept').includes('text/event-stream') ||
    getRequestHeader(options, 'content-type').includes('application/grpc-web')
  );
}

// Resolves when the body has arrived, so fetch outcomes are timed like axios.
// React Native's fetch resolves only after the body, and has no body stream.
function whenBodyEnds(res: Response): Promise<void> {
  const reader = res.body?.getReader?.();
  if (!reader) return Promise.resolve();
  const drain = (): Promise<void> =>
    reader.read().then(({ done }) => (done ? undefined : drain()));
  return drain();
}

function getUrlFromResource(resource: RequestInfo | URL | string) {
  if (isString(resource)) {
    return resource;
  }
  if (resource instanceof URL) {
    return resource.href;
  }
  return resource.url;
}

const fetchOrigin = fetch;
const newFetch = async function (
  resource: RequestInfo | URL | string,
  options?: RequestInit,
  ...others: any[]
) {
  if (isNil(options)) {
    // eslint-disable-next-line no-param-reassign
    options = {};
  }
  const resourceInfo = resource as Request;

  // Request, Headers, tuple arrays and plain objects must share the same
  // case-insensitive merge so an explicit caller UA is always preserved.
  const requestHeaders = new Headers(resourceInfo?.headers);
  new Headers(options.headers).forEach((value, key) => {
    requestHeaders.set(key, value);
  });

  const url = getUrlFromResource(resource);
  // same contract as checkRequestIsOneKeyDomain (Interceptor.ts): runtimes that
  // never init requestHelper (ext offscreen, CLI, electron main) throw here —
  // skip OneKey headers instead of breaking the fetch itself.
  let isOneKeyDomain = false;
  try {
    isOneKeyDomain = await requestHelper.checkIsOneKeyDomain(url);
  } catch (_error) {
    isOneKeyDomain = false;
  }
  let requestId: string | undefined;
  if (isOneKeyDomain) {
    const headers = await getRequestHeaders();
    requestId = headers[HEADER_REQUEST_ID_KEY];
    Object.entries(headers).forEach(([key, value]) => {
      requestHeaders.set(key, value);
    });
    options.headers = await withCustomUAHeaders(
      url,
      Object.fromEntries(requestHeaders.entries()),
      { browserTransport: true },
    );
  } else if (resourceInfo?.headers) {
    options.headers = Object.fromEntries(requestHeaders.entries());
  }

  if (isEnableLogNetwork(url)) {
    defaultLogger.app.network.start('fetch', options.method, url, requestId);
  }

  const availabilityTiming =
    (options as Record<string, unknown>)[AVAILABILITY_COUNTED_FETCH_OPTION] ||
    isStreamingRequest(options)
      ? undefined
      : createApiAvailabilityTiming({ url });
  // A Request carries its own signal, which `options.signal` overrides when
  // set. Reading only the latter counted a Request's timeout as a cancellation.
  const abortSignal: unknown = options.signal ?? resourceInfo?.signal;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
  return (
    fetchOrigin
      // @ts-ignore
      .call(this, resource, options, ...others)
      .then((res) => {
        void systemTimeUtils.handleServerResponseDate({
          source: 'fetch',
          headerDate: res?.headers?.get?.('date') || '',
          url: res?.url || url || '',
          requestId,
        });

        if (isEnableLogNetwork(url)) {
          defaultLogger.app.network.end({
            requestType: 'fetch',
            method: options?.method as string,
            path: url,
            statusCode: res.status,
            requestId,
          });
        }
        if (res.status >= 400) {
          // The outcome is known; callers may drop error bodies unread.
          reportApiAvailabilityResponse({
            timing: availabilityTiming,
            httpStatus: res.status,
          });
          return res;
        }
        if (!availabilityTiming) {
          return res;
        }
        // The caller reads a clone while the original is drained to time the
        // body. Cloning only here keeps an unread copy off long streams, and
        // lets the caller's cancel close them.
        const response = res.clone();
        void whenBodyEnds(res).then(
          () =>
            reportApiAvailabilityResponse({
              timing: availabilityTiming,
              httpStatus: res.status,
            }),
          (e: unknown) =>
            reportApiAvailabilityError(availabilityTiming, e, abortSignal),
        );
        return response;
      })
      .catch((e: unknown) => {
        reportApiAvailabilityError(availabilityTiming, e, abortSignal);
        if (e) {
          defaultLogger.app.network.error({
            requestType: 'fetch',
            method: options?.method as string,
            path: url,
            statusCode:
              typeof e === 'object' && 'code' in e ? (e.code as number) : -1,
            errorMessage:
              typeof e === 'object' && 'message' in e
                ? (e.message as string)
                : String(e),
            requestId,
          });
        }
        throw e;
      })
  );
};
Reflect.defineProperty(newFetch, 'isNormalizedByOneKey', {
  configurable: false,
  enumerable: false,
  value: true,
  writable: false,
});
console.log('fetchInterceptor.ts', fetch);
if (
  globalThis.fetch &&
  // @ts-ignore
  !globalThis.fetch.isNormalizedByOneKey
) {
  // **** for global instance of fetch
  globalThis.fetch = newFetch;
}
