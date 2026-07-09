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

type IHardwareConfigSource = {
  url: string;
  isCustomSource: boolean;
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

async function getHardwareConfigSource(
  originalUrl: string,
  hardwareConfigUrl?: string,
): Promise<IHardwareConfigSource> {
  const explicitCustomUrl = hardwareConfigUrl?.trim();
  if (explicitCustomUrl) {
    return {
      url: explicitCustomUrl,
      isCustomSource: true,
    };
  }

  const devSettings = await getFirmwareUpdateDevSettingsFromStorage();
  const customUrl =
    devSettings?.hardwareConfigUrl?.trim() ||
    process.env.HARDWARE_SDK_CONFIG_SRC?.trim();

  if (customUrl) {
    return {
      url: customUrl,
      isCustomSource: true,
    };
  }

  return {
    url: originalUrl,
    isCustomSource: false,
  };
}

async function resolveHardwareConfigUrl(
  url: string,
  hardwareConfigUrl?: string,
) {
  const sourceUrl = new URL(url);
  if (sourceUrl.hostname !== 'data.onekey.so') {
    return sourceUrl.toString();
  }

  const { url: targetHardwareConfigUrl, isCustomSource } =
    await getHardwareConfigSource(sourceUrl.toString(), hardwareConfigUrl);
  if (!isCustomSource) {
    return sourceUrl.toString();
  }

  const targetUrl = new URL(targetHardwareConfigUrl);
  if (targetUrl.pathname === '/') {
    targetUrl.pathname = sourceUrl.pathname;
  }
  sourceUrl.searchParams.forEach((value, key) => {
    if (!targetUrl.searchParams.has(key)) {
      targetUrl.searchParams.set(key, value);
    }
  });
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

export async function createConfigFetcher(params?: {
  hardwareConfigUrl?: string;
}): Promise<
  ((url: string) => Promise<RemoteConfigResponse | null>) | undefined
> {
  const initialConfigSource = await getHardwareConfigSource(
    'https://data.onekey.so/config.json',
    params?.hardwareConfigUrl,
  );

  // Always use configFetcher for an explicit dev config source, even on
  // platforms that do not support IP Table.
  try {
    const { isSupportIpTablePlatform } = await import('../utils/ipTableUtils');
    if (!initialConfigSource.isCustomSource && !isSupportIpTablePlatform()) {
      return undefined;
    }
  } catch {
    if (!initialConfigSource.isCustomSource) {
      return undefined;
    }
  }

  return async (url: string) => {
    const resolvedUrl = await resolveHardwareConfigUrl(
      url,
      params?.hardwareConfigUrl,
    );
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
