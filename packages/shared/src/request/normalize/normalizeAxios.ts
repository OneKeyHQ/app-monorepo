/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/unbound-method */
import axios from 'axios';
import { isNil, isString } from 'lodash';

import {
  RequestInterceptorBase,
  RequestLibNames,
} from './RequestInterceptorBase';

import type { Axios, AxiosRequestConfig } from 'axios';

class RequestInterceptorAxios extends RequestInterceptorBase {
  constructor(axiosConfig: AxiosRequestConfig) {
    super();
    this.axiosConfig = axiosConfig;
  }

  axiosConfig: AxiosRequestConfig;

  requestLibName: RequestLibNames = RequestLibNames.axios;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setDefaultRetry(count: number): void {}

  setDefaultTimeout(ms: number): void {
    if (isNil(this.axiosConfig.timeout)) {
      this.axiosConfig.timeout = ms;
    }
  }

  setHeader(key: string, val: string): void {
    this.axiosConfig.headers = this.axiosConfig.headers || {};
    this.axiosConfig.headers[key] = val;
  }
}

function buildInterceptRequest({
  originRequest,
}: {
  originRequest: typeof axios.Axios.prototype.request;
}) {
  return function (
    configOrUrl: AxiosRequestConfig | string | undefined,
    config: AxiosRequestConfig | undefined,
  ) {
    try {
      // @ts-ignore
      const self = this as Axios;
      let configObj = configOrUrl;
      if (isString(configObj)) {
        if (isNil(config)) {
          // eslint-disable-next-line no-param-reassign
          config = {};
        }
        configObj = config;
      }
      if (configObj) {
        const interceptor = new RequestInterceptorAxios(configObj);
        let url =
          configObj?.url || (isString(configOrUrl) ? configOrUrl : '') || '';

        // **** baseURL support
        if (
          !url.startsWith('http://') &&
          !url.startsWith('https://') &&
          self.defaults.baseURL
        ) {
          url = self.defaults.baseURL;
        }
        interceptor.interceptRequest({ url });
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
