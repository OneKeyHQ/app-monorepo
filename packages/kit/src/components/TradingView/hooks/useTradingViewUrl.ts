import { useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { getTradingViewTimezone } from '../utils/tradingViewTimezone';

interface IUseTradingViewUrlOptions {
  additionalParams?: Record<string, string>;
}

export function useTradingViewUrl(options: IUseTradingViewUrlOptions = {}) {
  const { additionalParams } = options;

  const calendars = useCalendars();
  const systemLocale = useLocaleVariant();
  const theme = useThemeVariant();
  const [devSettings] = useDevSettingsPersistAtom();
  const localTradingViewUrl = platformEnv.isNativeAndroid
    ? 'http://10.0.2.2:5173/'
    : 'http://localhost:5173/';

  const baseUrl = useMemo(() => {
    if (devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl) {
      return localTradingViewUrl;
    }

    if (devSettings.enabled) {
      return TRADING_VIEW_URL_TEST;
    }

    return TRADING_VIEW_URL;
  }, [
    devSettings.enabled,
    devSettings.settings?.useLocalTradingViewUrl,
    localTradingViewUrl,
  ]);

  const finalUrl = useMemo(() => {
    const timezone = getTradingViewTimezone(calendars);
    const locale = systemLocale;

    const url = new URL(baseUrl);
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('locale', locale);
    url.searchParams.set('platform', platformEnv.appPlatform ?? 'web');
    url.searchParams.set('theme', theme);
    if (platformEnv.version) {
      url.searchParams.set('appVersion', platformEnv.version);
    }

    // Add any additional parameters
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }, [baseUrl, calendars, systemLocale, theme, additionalParams]);

  return {
    baseUrl,
    finalUrl,
  };
}
