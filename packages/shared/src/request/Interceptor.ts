/* eslint-disable @typescript-eslint/no-restricted-imports */
import { Appearance } from 'react-native';

import { defaultColorScheme } from '@onekeyhq/kit/src/hooks/useSystemColorScheme';
import { checkIsOneKeyDomain } from '@onekeyhq/kit-bg/src/endpoints';
import {
  settingsPersistAtom,
  settingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

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
        isOneKeyDomain = await checkIsOneKeyDomain(url ?? '');
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

// Be consistent with backend platform definition
// https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/390266887#%E5%85%AC%E5%85%B1%E5%8F%82%E6%95%B0
export const headerPlatform = [platformEnv.appPlatform, platformEnv.appChannel]
  .filter(Boolean)
  .join('-');

export async function getRequestHeaders() {
  const settings = await settingsPersistAtom.get();
  const valueSettings = await settingsValuePersistAtom.get();

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
    [normalizeHeaderKey('X-Onekey-Request-Version')]:
      platformEnv.version as string,
    [normalizeHeaderKey('X-Onekey-Hide-Asset-Details')]: (
      valueSettings?.hideValue ?? false
    )?.toString(),
    [normalizeHeaderKey('X-Onekey-Request-Build-Number')]:
      platformEnv.buildNumber as string,
  };
}
