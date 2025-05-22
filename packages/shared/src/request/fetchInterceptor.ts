import { forEach, isNil, isString } from 'lodash';

import { defaultLogger } from '../logger/logger';
import { isEnableLogNetwork } from '../logger/scopes/app/scenes/network';
import systemTimeUtils from '../utils/systemTimeUtils';

import { HEADER_REQUEST_ID_KEY, getRequestHeaders } from './Interceptor';
import requestHelper from './requestHelper';

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
        return res.clone();
      })
      .catch((e: unknown) => {
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
console.log('fetchInterceptor.ts', fetch);
if (
  globalThis.fetch &&
  // @ts-ignore
  !globalThis.fetch.isNormalizedByOneKey
) {
  // **** for global instance of fetch
  globalThis.fetch = newFetch;
}
