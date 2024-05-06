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

let channel = ''

const getChannel = () => {
  if (channel) {
    return channel
  }
  if (platformEnv.isNativeIOS) {
    return 'app-store';
  }
  if (platformEnv.isNativeAndroid) {
    if (platformEnv.isNativeAndroidHuawei) {
      return 'store-huawei';
    }
    if (platformEnv.isNativeAndroidGooglePlay) {
      return 'store-google';
    }
    return 'out-store';
  }

  if (platformEnv.isDesktop) {
    if (platformEnv.isDesktopLinux) {
      return 'linux-out-store';
    } else if (platformEnv.isDesktopLinuxSnap) {
      return 'linux-snap-store';
    } else if (platformEnv.isDesktopMac) {
      return 'mac-out-store-x64';
    } else if (platformEnv.isDesktopMacArm64) {
      return 'mac-out-store-arm';
    } else if (platformEnv.isMas) {
      return 'mac-app-store';
    } else if (platformEnv.isDesktopWin) {
      return 'win-out-store';
    } else if (platformEnv.isDesktopWinMsStore) {
      return 'win-store';
    }
  }

  if (platformEnv.isExtension) {
    if (platformEnv.isExtChrome) {
      return 'chrome'
    } else if (platformEnv.isExtFirefox) {
      return 'firefox'
    } 
    return 'edge'
  }
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
    [normalizeHeaderKey('X-Onekey-Request-Channel')]: getChannel(),
  };
}
