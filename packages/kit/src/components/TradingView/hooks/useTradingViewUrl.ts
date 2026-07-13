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
import { TRADING_VIEW_DISABLED_FEATURES_URL_PARAM } from '../constants';
import { getTradingViewTimezone } from '../utils/tradingViewTimezone';

import type { ITradingViewDisabledFeature } from '../constants';

interface IUseTradingViewUrlOptions {
  additionalParams?: Record<string, string>;
  disabledFeatures?: readonly ITradingViewDisabledFeature[];
}

export function useTradingViewUrl(options: IUseTradingViewUrlOptions = {}) {
  const { additionalParams, disabledFeatures } = options;

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

  const timezone = useMemo(
    () => getTradingViewTimezone(calendars),
    [calendars],
  );

  const finalUrl = useMemo(() => {
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

    const serializedDisabledFeatures = disabledFeatures
      ?.filter(
        (feature, index, features) => features.indexOf(feature) === index,
      )
      .join(',');
    if (serializedDisabledFeatures) {
      url.searchParams.set(
        TRADING_VIEW_DISABLED_FEATURES_URL_PARAM,
        serializedDisabledFeatures,
      );
    }

    return url.toString();
  }, [
    additionalParams,
    baseUrl,
    disabledFeatures,
    systemLocale,
    theme,
    timezone,
  ]);

  return {
    baseUrl,
    finalUrl,
    timezone,
  };
}
