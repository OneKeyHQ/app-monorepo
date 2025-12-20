import {
  EServiceEndpointEnum,
  type IEndpointEnv,
  type IServiceEndpoint,
} from '@onekeyhq/shared/types/endpoint';

import platformEnv from '../platformEnv';
import requestHelper from '../request/requestHelper';

import { buildServiceEndpoint } from './appConfig';

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
    transfer: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Transfer,
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
    transfer: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Transfer,
      env: 'prod',
    }),
    rebate: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Rebate,
      env: 'prod',
    }),
  },
};

export const getEndpointsMapByDevSettings = (devSettings: {
  enabled: boolean;
  settings?: {
    enableTestEndpoint?: boolean;
  };
}) => {
  const env: IEndpointEnv =
    devSettings.enabled && devSettings.settings?.enableTestEndpoint
      ? 'test'
      : 'prod';

  return endpointsMap[env];
};

export async function getEndpointsMap() {
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

  return getEndpointsMapByDevSettings(settings);
}

export async function getEndpointByServiceName(
  serviceName: EServiceEndpointEnum,
) {
  if (!platformEnv.isWebEmbed && platformEnv.isDev) {
    // First try to get custom API endpoint from dev settings
    const devSettings = await requestHelper.getDevSettingsPersistAtom();
    const customEndpoints = devSettings.settings?.customApiEndpoints || [];
    const enabledCustomConfig = customEndpoints
      .filter((config) => config.enabled)
      .find((config) => config.serviceModule === serviceName);

    if (enabledCustomConfig && devSettings.enabled) {
      return enabledCustomConfig.api;
    }
  }

  // Fallback to default endpoint
  const map = await getEndpointsMap();
  return map[serviceName];
}
