/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/unbound-method */
import axios from 'axios';
import { isNil, isString } from 'lodash';

function buildInterceptRequest({
  originRequest,
}: {
  originRequest: typeof axios.Axios.prototype.request;
}) {
  // @ts-ignore
  return function (configOrUrl, config) {
    try {
      let configObj = configOrUrl;
      if (isString(configObj)) {
        if (isNil(config)) {
          // eslint-disable-next-line no-param-reassign
          config = {};
        }
        configObj = config;
      }
      if (configObj) {
        configObj.headers = configObj.headers || {};
        configObj.headers['X-Request-By'] = 'OneKey/axios';
        // configObj.timeout = 10; // global timeout
      }
    } catch (error) {
      // const e = error as Error | undefined;
      console.error('axios InterceptRequest ERROR', error);
    }
    // @ts-ignore
    const result = originRequest.call(
      // @ts-ignore
      this,
      configOrUrl,
      // @ts-ignore
      config,
    );

    // console.log('intercept axios request', configOrUrl, config, result);

    return result;
  };
}

export function normalizeAxios() {
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    global.$$axios = axios;
  }

  // **** for singleton instance of default axios
  // @ts-ignore
  axios.requestOrigin = axios.request;
  // @ts-ignore
  axios.request = buildInterceptRequest({
    // @ts-ignore
    originRequest: axios.requestOrigin,
  });

  // **** for new instance by axios.create()
  // @ts-ignore
  axios.Axios.prototype.requestOrigin = axios.Axios.prototype.request;
  // @ts-ignore
  axios.Axios.prototype.request = buildInterceptRequest({
    // @ts-ignore
    originRequest: axios.Axios.prototype.requestOrigin,
  });
}
