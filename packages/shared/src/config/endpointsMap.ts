import {
  EServiceEndpointEnum,
  type IEndpointEnv,
  type IServiceEndpoint,
} from '@onekeyhq/shared/types/endpoint';

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

export async function getEndpointByServiceName(
  serviceName: EServiceEndpointEnum,
) {
  const devSettings = await requestHelper.getDevSettingsPersistAtom();
  const map = getEndpointsMapByDevSettings(devSettings);
  return map[serviceName];
}
