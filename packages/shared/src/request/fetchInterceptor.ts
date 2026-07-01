import { forEach, isNil, isString } from 'lodash';

import { defaultLogger } from '../logger/logger';
import { isEnableLogNetwork } from '../logger/scopes/app/scenes/network';
import nativeNetworkThrottle, {
  NATIVE_SLOW_4G_LATENCY_MS,
  getNetworkThrottleRuntimeConfig,
} from '../modules/NetworkThrottle';
import platformEnv from '../platformEnv';
import systemTimeUtils from '../utils/systemTimeUtils';

import { HEADER_REQUEST_ID_KEY, getRequestHeaders } from './Interceptor';
import requestHelper from './requestHelper';

import type { INativeNetworkThrottleConfig } from '../modules/NetworkThrottle';

const LOG_URL_MAX_LENGTH = 160;

type IDiagnosticProcess = NodeJS.Process & {
  type?: string;
  versions?: NodeJS.ProcessVersions & {
    electron?: string;
  };
};

function getUrlFromResource(resource: RequestInfo | URL | string) {
  if (isString(resource)) {
    return resource;
  }
  if (resource instanceof URL) {
    return resource.href;
  }
  return resource.url;
}

function getRequestTimingNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getSanitizedRequestTarget(urlText: string) {
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

function shouldLogNetworkThrottleTiming(url: string) {
  return (
    (!!platformEnv.isNative || !!platformEnv.isDesktop) &&
    process.env.NODE_ENV !== 'test' &&
    isEnableLogNetwork(url)
  );
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

function getRuntimeDiagnosticPayload() {
  const currentProcess =
    typeof process === 'undefined'
      ? undefined
      : (process as IDiagnosticProcess);
  const currentLocation =
    typeof globalThis.location?.href === 'string'
      ? globalThis.location.href.split('?')[0].split('#')[0]
      : undefined;

  return {
    platform: platformEnv.appPlatform,
    runtime: platformEnv.runtimeRole,
    nativeRuntimeKind: platformEnv.nativeRuntimeKind,
    processType: currentProcess?.type,
    electronVersion: currentProcess?.versions?.electron,
    nodeVersion: currentProcess?.versions?.node,
    hasWindow: typeof globalThis.window !== 'undefined',
    hasDocument: typeof globalThis.document !== 'undefined',
    hasWorkerGlobalScope: typeof WorkerGlobalScope !== 'undefined',
    location: currentLocation?.slice(0, LOG_URL_MAX_LENGTH),
  };
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

  const shouldLogThrottleTiming = shouldLogNetworkThrottleTiming(url);
  const startedAt = shouldLogThrottleTiming ? getRequestTimingNow() : 0;
  const throttleConfig = shouldLogThrottleTiming
    ? await getNetworkThrottleTimingConfig().catch(() =>
        getNetworkThrottleRuntimeConfig(),
      )
    : undefined;
  if (throttleConfig) {
    defaultLogger.app.network.throttleDiagnostic('fetch.request', {
      ...getRuntimeDiagnosticPayload(),
      throttleEnabled: throttleConfig.enabled,
      throttleProfile: throttleConfig.profile,
      latencyMs: throttleConfig.latencyMs,
      method: options.method,
      target: getSanitizedRequestTarget(url),
      requestId,
    });
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
        if (throttleConfig) {
          defaultLogger.app.network.throttleDiagnostic('fetch.response', {
            ...getRuntimeDiagnosticPayload(),
            durationMs:
              Math.round((getRequestTimingNow() - startedAt) * 10) / 10,
            throttleEnabled: throttleConfig.enabled,
            throttleProfile: throttleConfig.profile,
            latencyMs: throttleConfig.latencyMs,
            method: options?.method as string,
            target: getSanitizedRequestTarget(url),
            requestId,
            statusCode: res.status,
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
        if (throttleConfig) {
          defaultLogger.app.network.throttleDiagnostic('fetch.error', {
            ...getRuntimeDiagnosticPayload(),
            durationMs:
              Math.round((getRequestTimingNow() - startedAt) * 10) / 10,
            throttleEnabled: throttleConfig.enabled,
            throttleProfile: throttleConfig.profile,
            latencyMs: throttleConfig.latencyMs,
            method: options?.method as string,
            target: getSanitizedRequestTarget(url),
            requestId,
            errorMessage:
              typeof e === 'object' && e && 'message' in e
                ? (e.message as string)
                : String(e),
          });
        }
        throw e;
      })
  );
};
Reflect.defineProperty(newFetch, 'isNormalizedByOneKey', {
  configurable: false,
  enumerable: false,
  value: true,
  writable: false,
});
if (
  globalThis.fetch &&
  // @ts-ignore
  !globalThis.fetch.isNormalizedByOneKey
) {
  // **** for global instance of fetch
  globalThis.fetch = newFetch;
}
