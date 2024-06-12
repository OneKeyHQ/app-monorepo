/* eslint-disable @typescript-eslint/no-restricted-imports */
import { Appearance } from 'react-native';

import { defaultColorScheme } from '@onekeyhq/kit/src/hooks/useSystemColorScheme';
import { checkIsOneKeyDomain } from '@onekeyhq/kit-bg/src/endpoints';
import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

export async function getRequestHeaders() {
  const settings = await settingsPersistAtom.get();

  let { locale, theme } = settings;

  if (locale === 'system') {
    locale = getDefaultLocale();
  }

  if (theme === 'system') {
    theme = Appearance.getColorScheme() ?? defaultColorScheme;
  }

  // Be consistent with backend platform definition
  // https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/390266887#%E5%85%AC%E5%85%B1%E5%8F%82%E6%95%B0
  const platform = platformEnv.appPlatform;
  const channel = platformEnv.appChannel;
  const headerPlatform = [platform, channel].filter(Boolean).join('-');

  return {
    [normalizeHeaderKey('X-Onekey-Request-ID')]: generateUUID(),
    [normalizeHeaderKey('X-Onekey-Request-Currency')]: settings.currencyInfo.id,
    [normalizeHeaderKey('X-Onekey-Request-Locale')]: locale,
    [normalizeHeaderKey('X-Onekey-Request-Theme')]: theme,
    [normalizeHeaderKey('X-Onekey-Request-Platform')]: headerPlatform,
    [normalizeHeaderKey('X-Onekey-Request-Version')]: platformEnv.version,
    [normalizeHeaderKey('X-Onekey-Request-Build-Number')]:
      platformEnv.buildNumber,
  };
}
