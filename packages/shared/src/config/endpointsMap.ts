import axios from 'axios';

import {
  EServiceEndpointEnum,
  type IEndpointEnv,
  type IServiceEndpoint,
} from '@onekeyhq/shared/types/endpoint';

import platformEnv from '../platformEnv';
import { getRequestHeaders } from '../request/Interceptor';
import requestHelper from '../request/requestHelper';
import { memoizee } from '../utils/cacheUtils';
import timerUtils from '../utils/timerUtils';

import { ONEKEY_API_HOST, buildServiceEndpoint } from './appConfig';

// Only OneKey endpoints are allowed here.
export const endpointsMap: Record<IEndpointEnv, IServiceEndpoint> = {
  test: {
    wallet: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Wallet,
      env: 'test',
    }),
    swap: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Swap,
      env: 'test',
    }),
    utility: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Utility,
      env: 'test',
    }),
    lightning: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Lightning,
      env: 'test',
    }),
    earn: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Earn,
      env: 'test',
    }),
    notification: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Notification,
      env: 'test',
    }),
    notificationWebSocket: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Notification,
      env: 'test',
      isWebSocket: true,
    }),
    prime: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Prime,
      env: 'test',
    }),
    rebate: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Rebate,
      env: 'test',
    }),
  },
  prod: {
    wallet: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Wallet,
      env: 'prod',
    }),
    swap: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Swap,
      env: 'prod',
    }),
    utility: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Utility,
      env: 'prod',
    }),
    lightning: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Lightning,
      env: 'prod',
    }),
    earn: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Earn,
      env: 'prod',
    }),
    notification: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Notification,
      env: 'prod',
    }),
    notificationWebSocket: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Notification,
      env: 'prod',
      isWebSocket: true,
    }),
    prime: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Prime,
      env: 'prod',
    }),
    rebate: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Rebate,
      env: 'prod',
    }),
  },
};

// Dynamic endpoint prefix check for shared layer
type IEndpointCheckResponse = {
  data: {
    needsPrefix: boolean;
  };
};

const checkEndpointPrefixRaw = async (): Promise<string | undefined> => {
  try {
    const requestUrl = `https://wallet.${ONEKEY_API_HOST}/wallet/v1/endpoint`;

    // Create clean axios instance without interceptors
    const cleanAxios = axios.create({
      timeout: 3000,
      baseURL: undefined,
    });

    // Clear interceptors to avoid side effects
    cleanAxios.interceptors.request.clear();
    cleanAxios.interceptors.response.clear();

    const requiredHeaders = await getRequestHeaders();

    const response = await cleanAxios.get<IEndpointCheckResponse>(requestUrl, {
      headers: requiredHeaders,
    });

    const needsPrefix = true;
    return needsPrefix ? 'by' : undefined;
  } catch (error) {
    return undefined; // Use default endpoints when check fails
  }
};

const checkEndpointPrefix = memoizee(checkEndpointPrefixRaw, {
  promise: true,
  maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
  max: 1,
});

export const getEndpointsMapByDevSettings = (
  devSettings: {
    enabled: boolean;
    settings?: {
      enableTestEndpoint?: boolean;
    };
  },
  options?: {
    prefix?: string;
  },
) => {
  const env: IEndpointEnv =
    devSettings.enabled && devSettings.settings?.enableTestEndpoint
      ? 'test'
      : 'prod';

  if (options?.prefix && env === 'prod') {
    // Generate prefixed endpoints for production only
    const prefixedEndpoints: IServiceEndpoint = {} as IServiceEndpoint;
    Object.entries(EServiceEndpointEnum).forEach(([, serviceName]) => {
      prefixedEndpoints[serviceName] = buildServiceEndpoint({
        serviceName,
        env,
        prefix: options.prefix,
      });
      // Handle WebSocket endpoint separately
      if (serviceName === EServiceEndpointEnum.Notification) {
        prefixedEndpoints[EServiceEndpointEnum.NotificationWebSocket] =
          buildServiceEndpoint({
            serviceName,
            env,
            prefix: options.prefix,
            isWebSocket: true,
          });
      }
    });
    return prefixedEndpoints;
  }

  return endpointsMap[env];
};

// Get endpoints with dynamic prefix checking
export async function getEndpointsMapWithDynamicPrefix() {
  // Get settings based on environment
  let settings: {
    enabled: boolean;
    settings?: { enableTestEndpoint?: boolean };
  };

  if (platformEnv.isWebEmbed) {
    const enableTestEndpoint =
      globalThis?.WEB_EMBED_ONEKEY_APP_SETTINGS?.enableTestEndpoint ?? false;
    settings = {
      enabled: enableTestEndpoint,
      settings: { enableTestEndpoint },
    };
  } else {
    settings = await requestHelper.getDevSettingsPersistAtom();
  }

  // Check endpoint prefix for production environment only
  const shouldCheckPrefix =
    !settings.enabled || !settings.settings?.enableTestEndpoint;
  let currentPrefix: string | undefined;

  if (shouldCheckPrefix) {
    currentPrefix = await checkEndpointPrefix();
  }

  return getEndpointsMapByDevSettings(settings, {
    prefix: currentPrefix,
  });
}

export async function getEndpointByServiceName(
  serviceName: EServiceEndpointEnum,
) {
  const map = await getEndpointsMapWithDynamicPrefix();
  return map[serviceName];
}

// Export method to force refresh endpoint check
export function forceRefreshEndpointCheck() {
  void checkEndpointPrefix.clear();
}
