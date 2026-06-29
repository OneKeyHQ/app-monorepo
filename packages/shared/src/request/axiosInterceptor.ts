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

import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import { defaultLogger } from '../logger/logger';
import { isEnableLogNetwork } from '../logger/scopes/app/scenes/network';
import nativeNetworkThrottle, {
  NATIVE_SLOW_4G_LATENCY_MS,
  getNetworkThrottleRuntimeConfig,
} from '../modules/NetworkThrottle';
import platformEnv from '../platformEnv';
import appStorage from '../storage/appStorage';
import { devSettingSyncStorage } from '../storage/instance/devSettingSyncStorageInstance';
import {
  EAppSyncStorageKeys,
  EDevSettingSyncStorageKeys,
} from '../storage/syncStorageKeys';
import systemTimeUtils from '../utils/systemTimeUtils';

import {
  HEADER_REQUEST_ID_KEY,
  checkRequestIsOneKeyDomain,
  getRequestHeaders,
} from './Interceptor';
import { REQUEST_TIMEOUT } from './requestConst';

import type { IAxiosResponse } from '../appApiClient/appApiClient';
import type { INativeNetworkThrottleConfig } from '../modules/NetworkThrottle';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

const NETWORK_THROTTLE_LOG_PREFIX = '[NETWORK-THROTTLE]';
const LOG_URL_MAX_LENGTH = 160;

type IAxiosNetworkTimingConfig = AxiosRequestConfig & {
  $oneKeyNetworkThrottleTiming?: {
    startedAt: number;
    throttleConfig: INativeNetworkThrottleConfig;
  };
};

let syncNativeNetworkThrottlePromise: Promise<boolean> | undefined;
let lastSyncedNativeNetworkThrottleEnabled: boolean | undefined;
let nativeNetworkThrottleSyncStorageHydrationTimedOut = false;
let nativeNetworkThrottleSyncedBeforeRequest = false;

const refreshNetInfo = debounce(() => {
  appEventBus.emit(EAppEventBusNames.RefreshNetInfo, undefined);
}, 2500);

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

function debugNetworkThrottleLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${NETWORK_THROTTLE_LOG_PREFIX} ${label}${valueText}`);
}

function shouldLogNetworkThrottleTiming() {
  return (
    !!platformEnv.isDev &&
    (!!platformEnv.isNative || !!platformEnv.isDesktop) &&
    process.env.NODE_ENV !== 'production'
  );
}

function getRequestTimingNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function normalizeDesktopNetworkThrottleTimingConfig(config: {
  enabled?: boolean;
  profile?: string;
}): INativeNetworkThrottleConfig {
  return {
    enabled: Boolean(config.enabled),
    profile: 'slow4g',
    latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
  };
}

async function syncNativeNetworkThrottleFromDevSettings(): Promise<boolean> {
  if (!platformEnv.isNative) {
    return true;
  }

  const enabled = await getPersistedNativeNetworkThrottleEnabled();
  const isStableStorageState =
    !nativeNetworkThrottleSyncStorageHydrationTimedOut;
  if (lastSyncedNativeNetworkThrottleEnabled === enabled) {
    return isStableStorageState;
  }

  await nativeNetworkThrottle.setNetworkThrottle({
    enabled,
    profile: 'slow4g',
    latencyMs: NATIVE_SLOW_4G_LATENCY_MS,
  });
  lastSyncedNativeNetworkThrottleEnabled = enabled;
  return isStableStorageState;
}

function readPersistedNativeNetworkThrottleEnabled(): boolean | undefined {
  const devModeEnabled = devSettingSyncStorage.getBoolean(
    EDevSettingSyncStorageKeys.onekey_developer_mode_enabled,
  );
  if (devModeEnabled === false) {
    nativeNetworkThrottleSyncStorageHydrationTimedOut = false;
    return false;
  }
  if (devModeEnabled === true) {
    nativeNetworkThrottleSyncStorageHydrationTimedOut = false;
    return devSettingSyncStorage.getBoolean(
      EDevSettingSyncStorageKeys.onekey_native_network_throttle_enabled,
    );
  }

  const appDevModeEnabled = appStorage.syncStorage.getBoolean(
    EAppSyncStorageKeys.onekey_developer_mode_enabled,
  );
  if (
    appDevModeEnabled === true &&
    !nativeNetworkThrottleSyncStorageHydrationTimedOut
  ) {
    return undefined;
  }

  return false;
}

async function getPersistedNativeNetworkThrottleEnabled(): Promise<boolean> {
  let enabled = readPersistedNativeNetworkThrottleEnabled();
  if (enabled !== undefined) {
    return enabled;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < 1500) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    enabled = readPersistedNativeNetworkThrottleEnabled();
    if (enabled !== undefined) {
      return enabled;
    }
  }
  nativeNetworkThrottleSyncStorageHydrationTimedOut = true;
  return false;
}

async function ensureNativeNetworkThrottleSyncedBeforeRequest() {
  if (!platformEnv.isNative || nativeNetworkThrottleSyncedBeforeRequest) {
    return;
  }

  syncNativeNetworkThrottlePromise ??=
    syncNativeNetworkThrottleFromDevSettings();
  try {
    nativeNetworkThrottleSyncedBeforeRequest =
      await syncNativeNetworkThrottlePromise;
  } finally {
    syncNativeNetworkThrottlePromise = undefined;
  }
}

async function getNetworkThrottleTimingConfig(): Promise<INativeNetworkThrottleConfig> {
  if (platformEnv.isDesktop) {
    const desktopConfig =
      await globalThis.desktopApiProxy?.dev?.getNetworkThrottle?.();
    if (desktopConfig) {
      return normalizeDesktopNetworkThrottleTimingConfig(desktopConfig);
    }
  }

  if (platformEnv.isNative) {
    return nativeNetworkThrottle.getNetworkThrottle();
  }

  return getNetworkThrottleRuntimeConfig();
}

function getSanitizedRequestTarget(config: AxiosRequestConfig) {
  const rawUrl = String(config.url ?? '');
  const rawBaseURL = String(config.baseURL ?? '');
  const urlText =
    rawBaseURL && rawUrl && !/^https?:\/\//i.test(rawUrl)
      ? `${rawBaseURL.replace(/\/$/, '')}/${rawUrl.replace(/^\//, '')}`
      : rawUrl || rawBaseURL;

  try {
    const parsedUrl = new URL(urlText);
    return `${parsedUrl.host}${parsedUrl.pathname}`.slice(
      0,
      LOG_URL_MAX_LENGTH,
    );
  } catch {
    const [withoutQuery] = urlText.split('?');
    const [withoutHash] = withoutQuery.split('#');
    return (withoutHash || '<unknown>').slice(0, LOG_URL_MAX_LENGTH);
  }
}

async function markNetworkThrottleRequestTiming(config: AxiosRequestConfig) {
  if (!shouldLogNetworkThrottleTiming()) {
    return;
  }

  const throttleConfig = await getNetworkThrottleTimingConfig().catch(() =>
    getNetworkThrottleRuntimeConfig(),
  );
  (config as IAxiosNetworkTimingConfig).$oneKeyNetworkThrottleTiming = {
    startedAt: getRequestTimingNow(),
    throttleConfig,
  };
}

function logNetworkThrottleRequestTiming({
  config,
  statusCode,
  responseCode,
  errorCode,
}: {
  config?: AxiosRequestConfig;
  statusCode?: number;
  responseCode?: unknown;
  errorCode?: unknown;
}) {
  if (!config || !shouldLogNetworkThrottleTiming()) {
    return;
  }

  const timingConfig = config as IAxiosNetworkTimingConfig;
  const timing = timingConfig.$oneKeyNetworkThrottleTiming;
  if (!timing) {
    return;
  }

  const durationMs =
    Math.round((getRequestTimingNow() - timing.startedAt) * 10) / 10;
  const throttleConfig = timing.throttleConfig;
  debugNetworkThrottleLog('axios.response', {
    durationMs,
    throttleEnabled: throttleConfig.enabled,
    throttleProfile: throttleConfig.profile,
    latencyMs: throttleConfig.latencyMs,
    platform: platformEnv.appPlatform,
    runtime: platformEnv.runtimeRole,
    nativeRuntimeKind: platformEnv.nativeRuntimeKind,
    method: config.method,
    target: getSanitizedRequestTarget(config),
    statusCode,
    responseCode,
    errorCode,
  });
}

axios.interceptors.request.use(async (config) => {
  await ensureNativeNetworkThrottleSyncedBeforeRequest().catch(() => undefined);

  if (config.timeout === undefined) {
    config.timeout = 30_000;
  }
  try {
    const isOneKeyDomain = await checkRequestIsOneKeyDomain({ config });

    if (!isOneKeyDomain) {
      if (isEnableLogNetwork(config.url)) {
        defaultLogger.app.network.start('axios', config.method, config.url);
      }
      await markNetworkThrottleRequestTiming(config);
      return config;
    }
  } catch (_e) {
    await markNetworkThrottleRequestTiming(config);
    return config;
  }

  const headers = await getRequestHeaders();
  forEach(headers, (val, key) => {
    // Preserve per-request currency header override (e.g. force 'usd' for search)
    if (
      key === 'x-onekey-request-currency' &&
      config.headers[key] !== null &&
      config.headers[key] !== undefined
    ) {
      return;
    }
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
  await markNetworkThrottleRequestTiming(config);
  return config;
});

axios.interceptors.response.use(
  async (response) => {
    // Guard: if request was aborted, convert to CanceledError regardless of response
    if (response.config?.signal?.aborted) {
      throw new axios.CanceledError('canceled');
    }
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
        logNetworkThrottleRequestTiming({
          config,
          statusCode: response.status,
          responseCode: response.data?.code,
        });
        return response;
      }
    } catch (_e) {
      logNetworkThrottleRequestTiming({
        config,
        statusCode: response.status,
      });
      return response;
    }

    const data = response.data as IOneKeyAPIBaseResponse;

    logNetworkThrottleRequestTiming({
      config,
      statusCode: response.status,
      responseCode: data.code,
    });

    if ((config as any).autoHandleError !== false && data.code !== 0) {
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
        httpStatusCode: response.status,
        data: {
          ...data,
          requestUrl: url,
        },
        requestId: config.headers[requestIdKey] as string,
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
    // Guard: if request was aborted, convert to CanceledError regardless of error type
    if (error?.config?.signal?.aborted) {
      throw new axios.CanceledError('canceled');
    }
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
          httpStatusCode: 403,
          requestId: description,
        });
      } else if (
        isOneKeyDomain &&
        Number(response.status) >= 500 &&
        Number(response.status) < 600
      ) {
        const title = appLocale.intl.formatMessage({
          id: ETranslations.global_server_error,
        });
        throw new OneKeyServerApiError({
          autoToast: false,
          message: title,
          code: Number(response.status),
          httpStatusCode: Number(response.status),
          requestId: config.headers[HEADER_REQUEST_ID_KEY],
        });
      }
    }

    logNetworkThrottleRequestTiming({
      config: error?.config,
      statusCode: response?.status,
      responseCode: response?.data?.code,
      errorCode: error?.code,
    });

    if (response?.status && typeof response.status === 'number') {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (error as any).httpStatusCode = response.status;
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
      // if (process.env.NODE_ENV !== 'production') {
      //   title += error?.config?.url || '';
      // }
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
    timeout: REQUEST_TIMEOUT,
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
