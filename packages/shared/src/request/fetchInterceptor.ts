import { forEach, isNil, isString } from 'lodash';

import { defaultLogger } from '../logger/logger';
import { isEnableLogNetwork } from '../logger/scopes/app/scenes/networkFilter';
import systemTimeUtils from '../utils/systemTimeUtils';

import {
  AVAILABILITY_TRACKED_FETCH_OPTION,
  createApiAvailabilityTiming,
  getAvailabilityFailureStatus,
  reportApiAvailabilityResult,
} from './availabilityMetrics';
import { HEADER_REQUEST_ID_KEY, getRequestHeaders } from './Interceptor';
import requestHelper from './requestHelper';

type IAvailabilityTrackedRequestInit = RequestInit & {
  [AVAILABILITY_TRACKED_FETCH_OPTION]?: boolean;
};

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
  const isAvailabilityTracked = Boolean(
    (options as IAvailabilityTrackedRequestInit)[
      AVAILABILITY_TRACKED_FETCH_OPTION
    ],
  );
  if (isAvailabilityTracked) {
    // Already counted by the axios interceptor. Continue with a marker-free
    // copy so the axios-owned fetchOptions object is not mutated below and
    // the native fetch receives the same init as without the marker.
    const {
      [AVAILABILITY_TRACKED_FETCH_OPTION]: _tracked,
      ...untrackedOptions
    } = options as IAvailabilityTrackedRequestInit;
    // eslint-disable-next-line no-param-reassign
    options = untrackedOptions;
  }
  const resourceInfo = resource as Request;

  // manifest v3 axios may pass headers in fetch resource
  // so we need merge headers from axios to fetch
  // @ts-ignore
  if (resourceInfo && resourceInfo.headers && resourceInfo.headers.entries) {
    const headersArr: Array<[string, string]> = Array.from(
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      resourceInfo.headers.entries(),
    );
    options.headers = options.headers || {};
    const { headers } = options;
    headersArr.forEach(([key, val]) => {
      if (
        key &&
        !(key in headers) &&
        !(key?.toLowerCase() in headers) &&
        !(key?.toUpperCase() in headers)
      ) {
        // @ts-ignore
        headers[key] = val;
      }
    });
  }

  const url = getUrlFromResource(resource);
  const isOneKeyDomain = await requestHelper.checkIsOneKeyDomain(url);
  let requestId: string | undefined;
  if (isOneKeyDomain) {
    options.headers = options.headers || {};
    const headers = await getRequestHeaders();
    requestId = headers[HEADER_REQUEST_ID_KEY];
    forEach(headers, (val, key) => {
      if (
        key &&
        !(key in headers) &&
        !(key?.toLowerCase() in headers) &&
        !(key?.toUpperCase() in headers)
      ) {
        // @ts-ignore
        headers[key] = val;
      }
      // @ts-ignore
      options.headers[key] = val;
    });
  }

  if (isEnableLogNetwork(url)) {
    defaultLogger.app.network.start('fetch', options.method, url, requestId);
  }

  const availabilityTiming = isAvailabilityTracked
    ? undefined
    : createApiAvailabilityTiming({ url });
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
        reportApiAvailabilityResult({
          httpStatusCode: res.status,
          status: res.ok ? 'ok' : 'http_error',
          timing: availabilityTiming,
        });
        return res.clone();
      })
      .catch((e: unknown) => {
        reportApiAvailabilityResult({
          errorCode:
            typeof e === 'object' && e && 'code' in e ? e.code : undefined,
          status: getAvailabilityFailureStatus(e),
          timing: availabilityTiming,
        });
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
