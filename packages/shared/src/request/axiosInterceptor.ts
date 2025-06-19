/* eslint-disable @typescript-eslint/no-restricted-imports */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import axios, { AxiosError } from 'axios';
import { debounce, forEach } from 'lodash';

import { OneKeyError, OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import { forceRefreshEndpointCheck } from '../config/endpointsMap';
import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import { defaultLogger } from '../logger/logger';
import { isEnableLogNetwork } from '../logger/scopes/app/scenes/network';
import platformEnv from '../platformEnv';
import systemTimeUtils from '../utils/systemTimeUtils';

import {
  HEADER_REQUEST_ID_KEY,
  checkRequestIsOneKeyDomain,
  getRequestHeaders,
} from './Interceptor';

import type { IAxiosResponse } from '../appApiClient/appApiClient';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

const refreshNetInfo = debounce(() => {
  appEventBus.emit(EAppEventBusNames.RefreshNetInfo, undefined);
}, 2500);

// Helper function to check if we should attempt fallback
async function shouldAttemptFallback(
  config: AxiosRequestConfig,
  errorOrBusinessCode?: AxiosError | number,
): Promise<boolean> {
  if (!config) return false;

  try {
    // Check if this is already a fallback request
    if ((config as any)._isFallbackRequest) return false;

    // Check if this is a OneKey domain request
    const isOneKeyDomain = await checkRequestIsOneKeyDomain({
      config: config as any,
    });
    if (!isOneKeyDomain) return false;

    // Check if the URL uses by- prefix
    const url = config.baseURL || config.url || '';
    const hasByPrefix = /^https:\/\/by-/.test(url);
    if (!hasByPrefix) return false;

    // If no error/code provided, fallback based on prefix only
    if (errorOrBusinessCode === undefined) return true;

    // Handle business error (number)
    if (typeof errorOrBusinessCode === 'number') {
      // Any non-zero business code indicates failure and warrants fallback
      return errorOrBusinessCode !== 0;
    }

    // Handle network error (AxiosError)
    const error = errorOrBusinessCode;
    const isNetworkError =
      error.code === AxiosError.ERR_NETWORK ||
      error.message === 'Network Error';
    const isServerError =
      error.response?.status && error.response.status >= 500;
    const isTimeoutError = error.code === AxiosError.ETIMEDOUT;

    return isNetworkError || isServerError || isTimeoutError;
  } catch (e) {
    return false;
  }
}

// Helper function to create fallback config with removed prefix
function createFallbackConfig(
  originalConfig: AxiosRequestConfig,
): AxiosRequestConfig {
  const newConfig = { ...originalConfig };

  // Remove by- prefix from URL
  if (newConfig.baseURL) {
    newConfig.baseURL = newConfig.baseURL.replace(/^https:\/\/by-/, 'https://');
  }
  if (newConfig.url) {
    newConfig.url = newConfig.url.replace(/^https:\/\/by-/, 'https://');
  }

  // Mark as fallback request to prevent loops
  (newConfig as any)._isFallbackRequest = true;

  return newConfig;
}

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
    const url =
      response?.request?.responseURL || config?.baseURL || config?.url || '';
    void systemTimeUtils.handleServerResponseDate({
      source: 'axios',
      headerDate: response?.headers?.date || '',
      url,
    });

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
      // Check if we should attempt fallback for business errors
      if (await shouldAttemptFallback(config, data.code)) {
        try {
          const fallbackConfig = createFallbackConfig(config);
          forceRefreshEndpointCheck(); // Clear prefix cache immediately

          // Create new axios instance to avoid interceptor loops
          const fallbackAxios = axios.create({
            timeout: config.timeout || 30_000,
          });

          const fallbackResponse = await fallbackAxios.request(fallbackConfig);

          // Check if fallback response contains business error and handle toast
          if (
            fallbackResponse.data &&
            typeof fallbackResponse.data === 'object'
          ) {
            const fallbackData =
              fallbackResponse.data as IOneKeyAPIBaseResponse;
            if (fallbackData.code !== 0) {
              // Handle business error from fallback response
              let autoToast = !!fallbackData?.message;
              if (fallbackData.disableAutoToast) {
                autoToast = false;
              }

              throw new OneKeyServerApiError({
                autoToast,
                disableFallbackMessage: true,
                message:
                  fallbackData?.translatedMessage ||
                  fallbackData?.message ||
                  'OneKeyServer Unknown Error',
                code: fallbackData.code,
                data: fallbackData,
                requestId: `RequestId: ${
                  fallbackConfig.headers?.[HEADER_REQUEST_ID_KEY] as string
                }`,
              });
            }
          }

          return fallbackResponse;
        } catch (fallbackError) {
          // If fallback error is a OneKeyServerApiError (business error), throw it directly
          if (fallbackError instanceof OneKeyServerApiError) {
            throw fallbackError;
          }

          // If fallback also fails, continue with original error handling
          console.warn(
            'Business error fallback request also failed:',
            fallbackError,
          );

          // Handle fallback errors properly
          if (fallbackError instanceof AxiosError) {
            if (fallbackError.response?.data) {
              // Business error from fallback
              const fallbackData = fallbackError.response
                .data as IOneKeyAPIBaseResponse;
              let autoToast = !!fallbackData?.message;
              if (fallbackData.disableAutoToast) {
                autoToast = false;
              }

              throw new OneKeyServerApiError({
                autoToast,
                disableFallbackMessage: true,
                message:
                  fallbackData?.translatedMessage ||
                  fallbackData?.message ||
                  'OneKeyServer Unknown Error',
                code: fallbackData.code,
                data: fallbackData,
                requestId: `RequestId: ${
                  config.headers[HEADER_REQUEST_ID_KEY] as string
                }`,
              });
            } else if (
              fallbackError.code === AxiosError.ERR_NETWORK ||
              fallbackError.message === 'Network Error'
            ) {
              // Network error from fallback
              const title = appLocale.intl.formatMessage({
                id: ETranslations.global_network_error,
              });
              throw new OneKeyError({
                name: fallbackError.name,
                message: title,
                className: EOneKeyErrorClassNames.AxiosNetworkError,
                key: ETranslations.global_network_error,
              });
            }
          }

          // If we can't handle the fallback error specifically, throw the original error
          throw fallbackError;
        }
      }

      const requestIdKey = HEADER_REQUEST_ID_KEY;
      if (platformEnv.isDev) {
        console.error(requestIdKey, config.headers[requestIdKey]);
      }

      let autoToast = !!data?.message;
      if (data.disableAutoToast) {
        autoToast = false;
      }

      throw new OneKeyServerApiError({
        autoToast,
        disableFallbackMessage: true,
        message:
          data?.translatedMessage ||
          data?.message ||
          'OneKeyServer Unknown Error',
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
      (response as IAxiosResponse<any>).$requestId =
        config.headers[HEADER_REQUEST_ID_KEY];
    }
    return response;
  },
  async (error) => {
    const { response, config: originalConfig } = error;

    // Check if we should attempt fallback
    if (
      originalConfig &&
      (await shouldAttemptFallback(originalConfig, error))
    ) {
      try {
        const fallbackConfig = createFallbackConfig(originalConfig);
        forceRefreshEndpointCheck(); // Clear prefix cache immediately

        // Create new axios instance to avoid interceptor loops
        const fallbackAxios = axios.create({
          timeout: originalConfig.timeout || 30_000,
        });

        const fallbackResponse = await fallbackAxios.request(fallbackConfig);

        // Check if fallback response contains business error and handle toast
        if (
          fallbackResponse.data &&
          typeof fallbackResponse.data === 'object'
        ) {
          const fallbackData = fallbackResponse.data as IOneKeyAPIBaseResponse;
          if (fallbackData.code !== 0) {
            // Handle business error from fallback response
            let autoToast = !!fallbackData?.message;
            if (fallbackData.disableAutoToast) {
              autoToast = false;
            }

            throw new OneKeyServerApiError({
              autoToast,
              disableFallbackMessage: true,
              message:
                fallbackData?.translatedMessage ||
                fallbackData?.message ||
                'OneKeyServer Unknown Error',
              code: fallbackData.code,
              data: fallbackData,
              requestId: `RequestId: ${
                fallbackConfig.headers?.[HEADER_REQUEST_ID_KEY] as string
              }`,
            });
          }
        }

        return fallbackResponse;
      } catch (fallbackError) {
        // If fallback error is a OneKeyServerApiError (business error), throw it directly
        if (fallbackError instanceof OneKeyServerApiError) {
          throw fallbackError;
        }

        // If fallback also fails, continue with original error handling
        console.warn('Fallback request also failed:', fallbackError);
      }
    }

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
