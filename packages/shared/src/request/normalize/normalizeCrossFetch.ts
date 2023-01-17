import { isNil } from 'lodash';

import platformEnv from '../../platformEnv';
/* patch node_modules/cross-fetch/dist/browser-ponyfill.js

var ctx = __self__; // this line disable service worker support temporarily
ctx.fetch = require('@onekeyhq/shared/src/request/normalize/normalizeCrossFetch').normalizeCrossFetch({
  fetch: ctx.fetch
});

 */
type ICrossFetch = typeof import('cross-fetch');
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
    resource: RequestInfo | URL,
    options?: RequestInit,
    ...others: any[]
  ) {
    if (isNil(options)) {
      // eslint-disable-next-line no-param-reassign
      options = {};
    }
    options.headers = options.headers || {};
    // @ts-ignore
    options.headers['X-Request-By'] = 'OneKey/fetch';
    if (options.signal) {
      if (!platformEnv.isNative) {
        // console.log('cross-fetch with timeout signal >>>>>');
      }
    }

    if (!platformEnv.isNative) {
      // TODO native console cause cycle request, should ignore http://localhost:8081/logs
      // http://localhost:8081/logs
      // console.log(
      //   'cross-fetch intercept request 008 >>>> ',
      //   resource,
      //   options,
      //   others,
      // );
    }

    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
    return fetchOrigin.call(this, resource, options, ...others);
  };
  newFetch.isNormalizedByOneKey = true;

  // @ts-ignore
  if (!global.fetch.isNormalizedByOneKey) {
    // **** for global instance of fetch
    global.fetch = newFetch;
  }

  // @ts-ignore
  return newFetch as ICrossFetch;
}
