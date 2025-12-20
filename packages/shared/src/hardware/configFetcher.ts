import axios from 'axios';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';
import type { AxiosInstance } from 'axios';

// Cached axios instance with IP Table adapter for config fetching
let configFetcherAxios: AxiosInstance | null = null;

async function getConfigFetcherAxios(): Promise<AxiosInstance> {
  if (!configFetcherAxios) {
    const baseConfig = {
      timeout: 7000,
    };

    let ipTableAdapter;
    try {
      const { isSupportIpTablePlatform } = await import(
        '../utils/ipTableUtils'
      );
      if (isSupportIpTablePlatform()) {
        const { createIpTableAdapter } = await import(
          '../request/helpers/ipTableAdapter'
        );
        ipTableAdapter = createIpTableAdapter(baseConfig);
      }
    } catch (error) {
      console.warn('[HardwareSDK] Failed to load IP Table adapter:', error);
    }

    configFetcherAxios = axios.create({
      ...baseConfig,
      adapter: ipTableAdapter,
    });
  }
  return configFetcherAxios;
}

export async function createConfigFetcher(): Promise<
  ((url: string) => Promise<RemoteConfigResponse | null>) | undefined
> {
  // Only create configFetcher for platforms that support IP Table
  // Otherwise return undefined to let SDK use its default fetching logic
  try {
    const { isSupportIpTablePlatform } = await import('../utils/ipTableUtils');
    if (!isSupportIpTablePlatform()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return async (url: string) => {
    console.log('[HardwareSDK] configFetcher url:', url);
    try {
      const axiosInstance = await getConfigFetcherAxios();
      const response = await axiosInstance.get<RemoteConfigResponse>(url, {
        timeout: 7000,
      });
      console.log('[HardwareSDK] configFetcher success');
      return response.data;
    } catch (error) {
      console.warn('[HardwareSDK] configFetcher error:', error);
      return null;
    }
  };
}
