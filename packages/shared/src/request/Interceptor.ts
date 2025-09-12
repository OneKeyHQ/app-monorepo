import { Appearance } from 'react-native';

import type {
  ISettingsPersistAtom,
  ISettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import appDeviceInfo from '../appDeviceInfo/appDeviceInfo';
import { defaultColorScheme } from '../config/appConfig';

import { headerPlatform } from './InterceptorConsts';
import requestHelper from './requestHelper';

import type { InternalAxiosRequestConfig } from 'axios';

export function normalizeHeaderKey(key: string) {
  return key?.toLowerCase() ?? key;
}

export async function checkRequestIsOneKeyDomain({
  config,
}: {
  config: InternalAxiosRequestConfig;
}) {
  let isOneKeyDomain = false;

  const check = async (url: string | undefined) => {
    try {
      if (url) {
        isOneKeyDomain = await requestHelper.checkIsOneKeyDomain(url ?? '');
      }
    } catch (error) {
      isOneKeyDomain = false;
    }
  };

  const baseUrl = config?.baseURL || '';
  await check(baseUrl);

  if (!isOneKeyDomain) {
    if (platformEnv.isDev && process.env.ONEKEY_PROXY) {
      const proxyUrl = config?.headers?.['X-OneKey-Dev-Proxy'];
      await check(proxyUrl);
    }
  }

  if (!isOneKeyDomain) {
    await check(config?.url);
  }

  return isOneKeyDomain;
}

export const HEADER_REQUEST_ID_KEY = normalizeHeaderKey('X-Onekey-Request-ID');

export async function getRequestHeaders() {
  const appDeviceInfoData = await appDeviceInfo.getDeviceInfo();
  const settings: ISettingsPersistAtom =
    await requestHelper.getSettingsPersistAtom();
  const valueSettings: ISettingsValuePersistAtom =
    await requestHelper.getSettingsValuePersistAtom();

  let { locale, theme } = settings;

  if (locale === 'system') {
    locale = getDefaultLocale();
  }

  if (theme === 'system') {
    theme = Appearance.getColorScheme() ?? defaultColorScheme;
  }

  const requestId = generateUUID();
  return {
    [HEADER_REQUEST_ID_KEY]: requestId,
    [normalizeHeaderKey('X-Amzn-Trace-Id')]: requestId,
    [normalizeHeaderKey('X-Onekey-Request-Currency')]: settings.currencyInfo.id,
    [normalizeHeaderKey('X-Onekey-Instance-Id')]: settings.instanceId,
    [normalizeHeaderKey('X-Onekey-Request-Locale')]: locale.toLowerCase(),
    [normalizeHeaderKey('X-Onekey-Request-Theme')]: theme,
    [normalizeHeaderKey('X-Onekey-Request-Platform')]: headerPlatform,
    [normalizeHeaderKey('X-Onekey-Request-Platform-Name')]:
      appDeviceInfoData.displayName || 'Unknown',
    [normalizeHeaderKey('X-Onekey-Request-Device-Name')]:
      platformEnv.appFullName,
    [normalizeHeaderKey('X-Onekey-Request-Version')]:
      platformEnv.version as string,
    [normalizeHeaderKey('X-Onekey-Hide-Asset-Details')]: (
      valueSettings?.hideValue ?? false
    )?.toString(),
    [normalizeHeaderKey('X-Onekey-Request-Build-Number')]:
      platformEnv.buildNumber as string,
  };
}
