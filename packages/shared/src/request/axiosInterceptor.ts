/* eslint-disable @typescript-eslint/no-restricted-imports */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import axios, { AxiosError } from 'axios';
import { debounce, forEach } from 'lodash';

import { OneKeyError, OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { refresh } from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import { defaultLogger } from '../logger/logger';
import { isEnableLogNetwork } from '../logger/scopes/app/scenes/network';
import platformEnv from '../platformEnv';

import {
  HEADER_REQUEST_ID_KEY,
  checkRequestIsOneKeyDomain,
  getRequestHeaders,
} from './Interceptor';

import type { AxiosInstance, AxiosRequestConfig } from 'axios';

const refreshNetInfo = debounce(() => {
  void refresh();
}, 1000);

axios.interceptors.request.use(async (config) => {
  if (config.timeout === undefined) {
    config.timeout = 30_000;
  }
  try {
    const isOneKeyDomain = await checkRequestIsOneKeyDomain({ config });

    if (!isOneKeyDomain) {
      if (isEnableLogNetwork(config.url)) {
        defaultLogger.app.network.start('axios', config.method, config.url);
      }
      return config;
    }
  } catch (e) {
    return config;
  }

  const headers = await getRequestHeaders();
  forEach(headers, (val, key) => {
    config.headers[key] = val;
  });

  if (isEnableLogNetwork(config.url)) {
    defaultLogger.app.network.start(
      'axios',
      config.method,
      config.url,
      headers[HEADER_REQUEST_ID_KEY],
    );
  }
  return config;
});

axios.interceptors.response.use(
  async (response) => {
    const { config } = response;

    try {
      const isOneKeyDomain = await checkRequestIsOneKeyDomain({ config });
      if (!isOneKeyDomain) {
        if (isEnableLogNetwork(config.url)) {
          defaultLogger.app.network.end({
            requestType: 'axios',
            method: config.method as string,
            path: config.url as string,
            statusCode: response.status,
            requestId: config.headers[HEADER_REQUEST_ID_KEY],
            responseCode: response.data.code,
          });
        }
        return response;
      }
    } catch (e) {
      return response;
    }

    const data = response.data as IOneKeyAPIBaseResponse;

    if ((config as any).autoHandleError !== false && data.code !== 0) {
      const requestIdKey = HEADER_REQUEST_ID_KEY;
      if (platformEnv.isDev) {
        console.error(requestIdKey, config.headers[requestIdKey]);
      }

      throw new OneKeyServerApiError({
        autoToast: true,
        disableFallbackMessage: true,
        message: data.message,
        code: data.code,
        data,
        requestId: `RequestId: ${config.headers[requestIdKey] as string}`,
      });
    }
    if (isEnableLogNetwork(config.url)) {
      defaultLogger.app.network.end({
        requestType: 'axios',
        method: config.method as string,
        path: config.url as string,
        statusCode: response.status,
        requestId: config.headers[HEADER_REQUEST_ID_KEY],
        responseCode: data.code,
        responseErrorMessage: data.code !== 0 ? data.message : '',
      });
    }
    return response;
  },
  async (error) => {
    const { response } = error;
    if (response?.status && response?.config) {
      const config = response.config;
      const isOneKeyDomain = await checkRequestIsOneKeyDomain({
        config,
      });
      defaultLogger.app.network.error({
        requestType: 'axios',
        method: config.method as string,
        path: config.url as string,
        statusCode: response?.status,
        requestId: config.headers[HEADER_REQUEST_ID_KEY],
        responseCode: response?.data?.code,
        errorMessage: response?.data?.message,
      });
      if (isOneKeyDomain && Number(response.status) === 403) {
        const title = appLocale.intl.formatMessage({
          id: ETranslations.title_403,
        });
        const description = appLocale.intl.formatMessage({
          id: ETranslations.description_403,
        });
        throw new OneKeyServerApiError({
          autoToast: true,
          message: title,
          code: 403,
          requestId: description,
        });
      }
    }
    if (
      error &&
      error instanceof AxiosError &&
      error.message === 'Network Error' &&
      error.code === AxiosError.ERR_NETWORK &&
      error.name === 'AxiosError'
    ) {
      refreshNetInfo();
      const title = appLocale.intl.formatMessage({
        id: ETranslations.global_network_error,
      });
      throw new OneKeyError({
        name: error.name,
        message: title,
        className: EOneKeyErrorClassNames.AxiosNetworkError,
        key: ETranslations.global_network_error,
      });
    }
    throw error;
  },
);

const orgCreate = axios.create;
axios.create = function (config?: AxiosRequestConfig): AxiosInstance {
  const defaultConfig: AxiosRequestConfig = {
    timeout: 30_000,
  };
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    timeout:
      config?.timeout !== undefined ? config.timeout : defaultConfig.timeout,
  };
  const result = orgCreate.call(this, mergedConfig);
  forEach((axios.interceptors.request as any).handlers, (handler) => {
    result.interceptors.request.use(handler.fulfilled, handler.rejected);
  });
  forEach((axios.interceptors.response as any).handlers, (handler) => {
    result.interceptors.response.use(handler.fulfilled, handler.rejected);
  });
  return result;
};
