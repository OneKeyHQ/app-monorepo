/* eslint-disable @typescript-eslint/no-restricted-imports */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import { forEach } from 'lodash';

import { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import { checkRequestIsOneKeyDomain, getRequestHeaders } from './Interceptor';

import type { AxiosInstance, AxiosRequestConfig } from 'axios';

axios.interceptors.request.use(async (config) => {
  try {
    const isOneKeyDomain = await checkRequestIsOneKeyDomain({ config });
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
    const isOneKeyDomain = await checkRequestIsOneKeyDomain({ config });
    if (!isOneKeyDomain) return response;
  } catch (e) {
    return response;
  }

  const data = response.data as IOneKeyAPIBaseResponse;

  if (data.code !== 0) {
    throw new OneKeyServerApiError({
      autoToast: true,
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
