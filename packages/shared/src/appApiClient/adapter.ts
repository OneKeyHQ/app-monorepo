import axios, { getAdapter } from 'axios';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { AxiosRequestConfig, AxiosResponse } from 'axios';

export function createCacheAdapter() {
  //   const cache = new CacheService(storage);
  const adapter = getAdapter('xhr');

  return async function (config: AxiosRequestConfig): Promise<AxiosResponse> {
    console.log('config-runnerId', config.runnerId);
    const url = axios.getUri(config);

    if (config.runnerId) {
      setTimeout(async () => {
        console.log('config-runnerId', config.runnerId);
        const response = await adapter(config as any);
        appEventBus.emit(
          EAppEventBusNames.UsePromiseResultEventId,
          config.runnerId as string,
        );
      }, 0);
      return {
        data: {
          code: 0,
          data: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config as any,
      };
    }
    const response = await adapter(config as any);

    return response;
  };
}
