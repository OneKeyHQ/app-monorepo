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

const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';

export function normalizeHeaderKey(key: string) {
  return key?.toLowerCase() ?? key;
}

async function getThemeFromExtensionStorage(): Promise<
  'light' | 'dark' | undefined
> {
  if (!platformEnv.isExtension) {
    return;
  }
  try {
    const data = await globalThis.chrome?.storage?.local?.get(
      THEME_PRELOAD_STORAGE_KEY,
    );
    const theme = data?.[THEME_PRELOAD_STORAGE_KEY] as unknown;
    if (theme === 'light' || theme === 'dark') {
      return theme;
    }
  } catch {
    return defaultColorScheme;
  }
}

async function resolveThemeVariantFromSettings(
  theme: 'light' | 'dark' | 'system',
) {
  if (theme !== 'system') {
    return theme;
  }

  if (!platformEnv.isExtension) {
    const colorScheme = Appearance.getColorScheme();
    return colorScheme === 'light' || colorScheme === 'dark'
      ? colorScheme
      : defaultColorScheme;
  }

  const fromExtStorage = await getThemeFromExtensionStorage();
  if (fromExtStorage) return fromExtStorage;

  return defaultColorScheme;
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
    } catch (_error) {
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

const DEFAULT_PLATFORM_NAME = 'Unknown';
// Android displayName is the user-editable device name. OkHttp (expo/fetch,
// SNI, expo-file-system uploads) throws on header values outside tab and
// printable ASCII.
const UNSAFE_HEADER_VALUE_RE = /[^\t\x20-\x7E]/;
let platformNameHeaderValuePromise: Promise<string> | undefined;

function getPlatformNameHeaderValue(): Promise<string> {
  platformNameHeaderValuePromise ??= Promise.resolve()
    .then(() => appDeviceInfo.getDeviceInfo())
    .then((deviceInfo) => {
      const name = deviceInfo.displayName || DEFAULT_PLATFORM_NAME;
      if (!platformEnv.isNativeAndroid || !UNSAFE_HEADER_VALUE_RE.test(name)) {
        return name;
      }
      const model = deviceInfo.device.model || DEFAULT_PLATFORM_NAME;
      return UNSAFE_HEADER_VALUE_RE.test(model)
        ? encodeURIComponent(model)
        : model;
    })
    .catch(() => DEFAULT_PLATFORM_NAME);
  return platformNameHeaderValuePromise;
}

export async function getRequestHeaders() {
  const platformNameHeaderValue = await getPlatformNameHeaderValue();
  const settings: ISettingsPersistAtom =
    await requestHelper.getSettingsPersistAtom();
  const valueSettings: ISettingsValuePersistAtom =
    await requestHelper.getSettingsValuePersistAtom();

  let { locale, theme } = settings;

  if (locale === 'system') {
    locale = getDefaultLocale();
  }

  theme = await resolveThemeVariantFromSettings(theme);

  const requestId = generateUUID();
  const headers = {
    [HEADER_REQUEST_ID_KEY]: requestId,
    [normalizeHeaderKey('X-Amzn-Trace-Id')]: requestId,
    [normalizeHeaderKey('X-Onekey-Request-Currency')]: settings.currencyInfo.id,
    [normalizeHeaderKey('X-Onekey-Instance-Id')]: settings.instanceId,
    [normalizeHeaderKey('X-Onekey-Request-Locale')]: locale.toLowerCase(),
    [normalizeHeaderKey('X-Onekey-Request-Theme')]: theme,
    [normalizeHeaderKey('X-Onekey-Request-Platform')]: headerPlatform,
    [normalizeHeaderKey('X-Onekey-Request-Platform-Name')]:
      platformNameHeaderValue,
    [normalizeHeaderKey('X-Onekey-Request-Device-Name')]:
      platformEnv.appFullName,
    [normalizeHeaderKey('X-Onekey-Request-Version')]:
      platformEnv.version as string,
    [normalizeHeaderKey('X-Onekey-Hide-Asset-Details')]: (
      valueSettings?.hideValue ?? false
    )?.toString(),
    [normalizeHeaderKey('X-Onekey-Request-Build-Number')]:
      platformEnv.buildNumber as string,
    [normalizeHeaderKey('X-Onekey-Request-JSBundle-Version')]:
      platformEnv.bundleVersion as string,
  };

  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => typeof value === 'string'),
  );
}
