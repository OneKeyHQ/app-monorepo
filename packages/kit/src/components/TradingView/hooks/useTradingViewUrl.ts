import { useMemo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { useTradingViewTimezoneAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

interface IUseTradingViewUrlOptions {
  additionalParams?: Record<string, string>;
}

export function useTradingViewUrl(options: IUseTradingViewUrlOptions = {}) {
  const { additionalParams } = options;

  const systemLocale = useLocaleVariant();
  const theme = useThemeVariant();
  const [devSettings] = useDevSettingsPersistAtom();
  const [tradingViewTimezone] = useTradingViewTimezoneAtom();

  const baseUrl = useMemo(() => {
    if (devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl) {
      return 'http://localhost:5173/';
    }

    if (devSettings.enabled) {
      return TRADING_VIEW_URL_TEST;
    }

    return TRADING_VIEW_URL;
  }, [devSettings.enabled, devSettings.settings?.useLocalTradingViewUrl]);

  const finalUrl = useMemo(() => {
    const locale = systemLocale;

    const url = new URL(baseUrl);
    url.searchParams.set('locale', locale);
    url.searchParams.set('platform', platformEnv.appPlatform ?? 'web');
    url.searchParams.set('theme', theme);
    if (tradingViewTimezone) {
      url.searchParams.set('timezone', tradingViewTimezone);
    }
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
  }, [baseUrl, systemLocale, theme, tradingViewTimezone, additionalParams]);

  return {
    baseUrl,
    finalUrl,
  };
}
