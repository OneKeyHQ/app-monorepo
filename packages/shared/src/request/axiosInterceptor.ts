/* eslint-disable @typescript-eslint/no-restricted-imports */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import { forEach } from 'lodash';

import { checkIsOneKeyDomain } from '@onekeyhq/kit-bg/src/endpoints';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import { checkRequestIsOneKeyDomain, getRequestHeaders } from './Interceptor';

import type { AxiosInstance, AxiosRequestConfig } from 'axios';

axios.interceptors.request.use(async (config) => {
  try {
    let isOneKeyDomain = await checkRequestIsOneKeyDomain(config.baseURL ?? '');

    if (!isOneKeyDomain) {
      if (platformEnv.isDev && process.env.ONEKEY_PROXY) {
        const proxyHeader =
          config?.headers?.['X-Proxy'] || config?.headers?.['x-proxy'];
        if (proxyHeader) {
          try {
            isOneKeyDomain = await checkIsOneKeyDomain(proxyHeader);
          } catch (error) {
            isOneKeyDomain = false;
          }
        }
      }
    }
    if (!isOneKeyDomain) return config;
  } catch (e) {
    return config;
  }

  const headers = await getRequestHeaders();
  forEach(headers, (val, key) => {
    config.headers[key] = val;
  });

  return config;
});

axios.interceptors.response.use(async (response) => {
  const { config } = response;
  try {
    const isOneKeyDomain = await checkRequestIsOneKeyDomain(
      config.baseURL ?? '',
    );
    if (!isOneKeyDomain) return response;
  } catch (e) {
    return response;
  }

  const data = response.data as IOneKeyAPIBaseResponse;

  if (data.code !== 0) {
    throw new OneKeyError({
      autoToast: false,
      message: data.message,
      code: data.code,
      data,
    });
  }
  return response;
});

const orgCreate = axios.create;
axios.create = function (config?: AxiosRequestConfig): AxiosInstance {
  const result = orgCreate.call(this, config);
  forEach((axios.interceptors.request as any).handlers, (handler) => {
    result.interceptors.request.use(handler.fulfilled, handler.rejected);
  });
  forEach((axios.interceptors.response as any).handlers, (handler) => {
    result.interceptors.response.use(handler.fulfilled, handler.rejected);
  });
  return result;
};
