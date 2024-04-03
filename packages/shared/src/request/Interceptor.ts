/* eslint-disable @typescript-eslint/no-restricted-imports */
import { Appearance } from 'react-native';

import { defaultColorScheme } from '@onekeyhq/kit/src/hooks/useSystemColorScheme';
import { checkIsOneKeyDomain } from '@onekeyhq/kit-bg/src/endpoints';
import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

export function normalizeHeaderKey(key: string) {
  return key?.toLowerCase() ?? key;
}

export async function checkRequestIsOneKeyDomain(url: string) {
  let isOneKeyDomain = false;

  try {
    isOneKeyDomain = await checkIsOneKeyDomain(url ?? '');
  } catch (error) {
    isOneKeyDomain = false;
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
    [normalizeHeaderKey('X-Onekey-Locale')]: locale,
    [normalizeHeaderKey('X-Onekey-Theme')]: theme,
    [normalizeHeaderKey('X-Onekey-Platform')]: headerPlatform,
    [normalizeHeaderKey('X-Onekey-Version')]: platformEnv.version,
    [normalizeHeaderKey('X-Onekey-Build-Number')]: platformEnv.buildNumber,
  };
}
