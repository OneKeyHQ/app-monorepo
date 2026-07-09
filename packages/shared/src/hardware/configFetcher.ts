import axios from 'axios';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';
import type { AxiosInstance } from 'axios';

// Cached axios instance with IP Table adapter for config fetching
let configFetcherAxios: AxiosInstance | null = null;

const FIRMWARE_UPDATE_DEV_SETTINGS_STORAGE_KEY =
  'g_states_v5:firmwareUpdateDevSettingsPersistAtom';

type IFirmwareUpdateDevSettingsPersisted = {
  hardwareConfigUrl?: string;
};

function parseFirmwareUpdateDevSettings(
  raw: string | null | undefined,
): IFirmwareUpdateDevSettingsPersisted | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as IFirmwareUpdateDevSettingsPersisted;
  } catch {
    return undefined;
  }
}

async function getFirmwareUpdateDevSettingsFromStorage() {
  if (platformEnv.isNative) {
    try {
      const { default: jotaiMMKV } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');
      const mmkvValue = parseFirmwareUpdateDevSettings(
        jotaiMMKV.getString(FIRMWARE_UPDATE_DEV_SETTINGS_STORAGE_KEY),
      );
      if (mmkvValue) {
        return mmkvValue;
      }
    } catch {
      // fallback to AsyncStorage below
    }
  }

  const storage = storageHub.$webStorageGlobalStates || storageHub.appStorage;
  return parseFirmwareUpdateDevSettings(
    await storage.getItem(FIRMWARE_UPDATE_DEV_SETTINGS_STORAGE_KEY),
  );
}

async function getHardwareConfigUrl(originalUrl: string) {
  const devSettings = await getFirmwareUpdateDevSettingsFromStorage();
  return (
    devSettings?.hardwareConfigUrl ||
    process.env.HARDWARE_SDK_CONFIG_SRC ||
    originalUrl
  );
}

async function resolveHardwareConfigUrl(url: string) {
  const sourceUrl = new URL(url);
  if (sourceUrl.hostname !== 'data.onekey.so') {
    return sourceUrl.toString();
  }

  const targetUrl = new URL(await getHardwareConfigUrl(sourceUrl.toString()));
  if (!targetUrl.pathname || targetUrl.pathname === '/') {
    targetUrl.pathname = sourceUrl.pathname;
  }
  targetUrl.search = sourceUrl.search;
  return targetUrl.toString();
}

async function getConfigFetcherAxios(): Promise<AxiosInstance> {
  if (!configFetcherAxios) {
    const baseConfig = {
      timeout: 7000,
    };

    let ipTableAdapter;
    try {
      const { isSupportIpTablePlatform } =
        await import('../utils/ipTableUtils');
      if (isSupportIpTablePlatform()) {
        const { createIpTableAdapter } =
          await import('../request/helpers/ipTableAdapter');
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
    const resolvedUrl = await resolveHardwareConfigUrl(url);
    console.log('[HardwareSDK] configFetcher url:', resolvedUrl);
    try {
      const axiosInstance = await getConfigFetcherAxios();
      const response = await axiosInstance.get<RemoteConfigResponse>(
        resolvedUrl,
        {
          timeout: 7000,
        },
      );
      console.log('[HardwareSDK] configFetcher success');
      return response.data;
    } catch (error) {
      console.warn('[HardwareSDK] configFetcher error:', error);
      return null;
    }
  };
}
