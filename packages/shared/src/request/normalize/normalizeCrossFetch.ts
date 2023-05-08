import { isNil, isString } from 'lodash';

import platformEnv from '../../platformEnv';

import {
  RequestInterceptorBase,
  RequestLibNames,
} from './RequestInterceptorBase';
/* patch node_modules/cross-fetch/dist/browser-ponyfill.js

var ctx = __self__; // this line disable service worker support temporarily
ctx.fetch = require('@onekeyhq/shared/src/request/normalize/normalizeCrossFetch').normalizeCrossFetch({
  fetch: ctx.fetch
});

 */

type ICrossFetch = typeof fetch;

class RequestInterceptorFetch extends RequestInterceptorBase {
  constructor(options: RequestInit) {
    super();
    this.options = options;
  }

  options: RequestInit;

  requestLibName: RequestLibNames = RequestLibNames.fetch;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setDefaultRetry(count: number): void {}

  // TODO
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setDefaultTimeout(ms: number): void {
    if (this.options.signal) {
      if (!platformEnv.isNative) {
        // console.log('cross-fetch with timeout signal >>>>>');
      }
    }
  }

  setHeader(key: string, val: string): void {
    this.options.headers = this.options.headers || {};
    // @ts-ignore
    this.options.headers[key] = val;
  }
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

export function normalizeCrossFetch({
  fetch,
}: {
  fetch: ICrossFetch;
}): ICrossFetch {
  // @ts-ignore
  if (fetch && fetch.isNormalizedByOneKey) {
    return fetch;
  }

  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.$$fetch = fetch;
  }

  const fetchOrigin = fetch;
  const newFetch = function (
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

    const interceptor = new RequestInterceptorFetch(options);
    const url = getUrlFromResource(resource);
    interceptor.interceptRequest({ url });

    if (!platformEnv.isNative) {
      // TODO native console log cause cycle request, should ignore http://localhost:8081/logs
      // http://localhost:8081/logs
      // console.log(
      //   'cross-fetch intercept request 008 >>>> ',
      //   resource,
      //   options,
      //   others,
      // );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
    return (
      fetchOrigin
        // @ts-ignore
        .call(this, resource, options, ...others)
        .then((res) => res.clone())
    );
  };
  newFetch.isNormalizedByOneKey = true;

  // @ts-ignore
  if (global.fetch && !global.fetch.isNormalizedByOneKey) {
    // **** for global instance of fetch
    global.fetch = newFetch;
  }

  // @ts-ignore
  return newFetch as ICrossFetch;
}
