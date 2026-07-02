import { useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { DESKTOP_OFFLINE_CHART_ENTRY_URL } from '@onekeyhq/shared/src/consts/desktopChartConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { TRADING_VIEW_DISABLED_FEATURES_URL_PARAM } from '../constants';
import { getDesktopOfflineChartReady } from '../utils/desktopOfflineChartReady';
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
  const desktopOfflineChartReady = getDesktopOfflineChartReady();

  const baseUrl = useMemo(() => {
    if (devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl) {
      return localTradingViewUrl;
    }

    if (desktopOfflineChartReady) {
      return DESKTOP_OFFLINE_CHART_ENTRY_URL;
    }

    if (devSettings.enabled) {
      return TRADING_VIEW_URL_TEST;
    }

    return TRADING_VIEW_URL;
  }, [
    devSettings.enabled,
    devSettings.settings?.useLocalTradingViewUrl,
    desktopOfflineChartReady,
    localTradingViewUrl,
  ]);

  const isOfflineChart =
    desktopOfflineChartReady && baseUrl === DESKTOP_OFFLINE_CHART_ENTRY_URL;

  const timezone = useMemo(
    () => getTradingViewTimezone(calendars),
    [calendars],
  );

  const params = useMemo(() => {
    const locale = systemLocale;
    const result: Record<string, string> = {
      timezone,
      locale,
      platform: platformEnv.appPlatform ?? 'web',
      theme,
    };
    if (platformEnv.version) {
      result.appVersion = platformEnv.version;
    }

    if (!isOfflineChart && additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        result[key] = value;
      });
    }

    const serializedDisabledFeatures = disabledFeatures
      ?.filter(
        (feature, index, features) => features.indexOf(feature) === index,
      )
      .join(',');
    if (!isOfflineChart && serializedDisabledFeatures) {
      result[TRADING_VIEW_DISABLED_FEATURES_URL_PARAM] =
        serializedDisabledFeatures;
    }

    return result;
  }, [
    additionalParams,
    disabledFeatures,
    isOfflineChart,
    systemLocale,
    theme,
    timezone,
  ]);

  const finalUrl = useMemo(() => {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }, [baseUrl, params]);

  return {
    baseUrl,
    finalUrl,
    isOfflineChart,
    params,
    timezone,
  };
}
