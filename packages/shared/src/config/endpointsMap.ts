import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import {
  EServiceEndpointEnum,
  type IEndpointEnv,
  type IServiceEndpoint,
} from '@onekeyhq/shared/types/endpoint';

import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import platformEnv from '../platformEnv';
import requestHelper from '../request/requestHelper';

import { buildServiceEndpoint } from './appConfig';

// Cache for endpoint prefix to avoid repeated appStorage calls
let endpointPrefixCache: string | null = null;

// Cached function to get endpoint prefix with storage fallback
export async function getCachedEndpointPrefix(): Promise<string | null> {
  if (endpointPrefixCache !== null) {
    return endpointPrefixCache;
  }

  try {
    const storedValue = await appStorage.getItem('ONEKEY_ENDPOINT_USE_PREFIX');
    endpointPrefixCache = storedValue;
    return storedValue;
  } catch (error) {
    console.warn('Failed to read endpoint prefix from storage:', error);
    endpointPrefixCache = null;
    return null;
  }
}

// Cached function to set endpoint prefix with cache invalidation
export async function setCachedEndpointPrefix(newValue: string): Promise<void> {
  try {
    // Always update storage
    await appStorage.setItem('ONEKEY_ENDPOINT_USE_PREFIX', newValue);
    endpointPrefixCache = newValue; // Update cache with new value
  } catch (error) {
    console.error('Failed to set endpoint prefix in storage:', error);
    // Clear cache on error to ensure consistency
    endpointPrefixCache = null;
  }
}

// Function to clear the endpoint prefix cache
export function clearEndpointPrefixCache(): void {
  endpointPrefixCache = null;
}

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
      // Skip NotificationWebSocket as it's handled separately when processing Notification
      if (serviceName === EServiceEndpointEnum.NotificationWebSocket) {
        return;
      }

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

  // For test environment, no prefix checking needed
  const isTestEnv = settings.enabled && settings.settings?.enableTestEndpoint;
  if (isTestEnv) {
    return getEndpointsMapByDevSettings(settings);
  }

  // Trigger endpoint check via event bus (ServiceApp will handle with memoizee)
  appEventBus.emit(EAppEventBusNames.CheckEndpointPrefix, {
    cleanAppClientCache: false,
  });

  // Read the stored endpoint prefix result from background service using cached function
  let currentPrefix: string | undefined;
  try {
    const shouldUsePrefix = await getCachedEndpointPrefix();

    if (shouldUsePrefix === 'true') {
      currentPrefix = 'by';
    }
  } catch (error) {
    console.warn('Failed to read endpoint prefix from storage:', error);
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

export function forceRefreshEndpointCheck() {
  // Clear axios client cache and trigger new check via event
  appEventBus.emit(EAppEventBusNames.CheckEndpointPrefix, {
    cleanAppClientCache: true,
  });
}
