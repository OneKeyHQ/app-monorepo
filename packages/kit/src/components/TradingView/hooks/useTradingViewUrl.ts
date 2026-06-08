import { useEffect, useMemo } from 'react';

import { useCalendars } from 'expo-localization';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { DESKTOP_OFFLINE_CHART_ENTRY_URL } from '@onekeyhq/shared/src/consts/desktopChartConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { getDesktopOfflineChartReady } from '../ChartWebView/ready';
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

  // Desktop offline chart: usable only when the bundle was shipped into the asar
  // (main process registered the onekey-chart:// handler and reports it ready via
  // the desktop global). Mirrors native's online fallback when assets are absent.
  const desktopOfflineChartReady = getDesktopOfflineChartReady();

  const baseUrl = useMemo(() => {
    // Dev "use local TradingView URL" always wins (chart dev server on :5173).
    if (devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl) {
      return localTradingViewUrl;
    }

    // Local offline chart served from the asar (onekey-chart://local/index.html).
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
    localTradingViewUrl,
    desktopOfflineChartReady,
  ]);

  // Desktop online-fallback diagnostic (see market.chart scene): when the asar
  // shipped no offline bundle, baseUrl stays the remote URL and the legacy
  // WebView renders, so ChartWebView/index.desktop.tsx never mounts to log it.
  // The OFFLINE desktop case is logged there instead; this covers only the
  // online fallback. Native is excluded — its baseUrl is always the online URL
  // used merely as fallback (the real offline/online decision lives in
  // ChartWebView/index.native.tsx), so logging it here would misreport "online".
  useEffect(() => {
    const isDesktopOffline = baseUrl === DESKTOP_OFFLINE_CHART_ENTRY_URL;
    if (!platformEnv.isDesktop || isDesktopOffline) {
      return;
    }
    defaultLogger.market.chart.chartSource({
      platform: platformEnv.appPlatform ?? 'desktop',
      mode: 'online',
      sourceKind: 'online',
      hasOnlineFallback: true,
    });
  }, [baseUrl]);

  // The full param set, shared by the online URL (query string) and the offline
  // chart-webview bundle (passed as paramsJson). Keeping a single source avoids
  // online/offline drift.
  const params = useMemo(() => {
    const result: Record<string, string> = {
      timezone: getTradingViewTimezone(calendars),
      locale: systemLocale,
      platform: platformEnv.appPlatform ?? 'web',
      theme,
    };
    if (platformEnv.version) {
      result.appVersion = platformEnv.version;
    }

    // Add any additional parameters (skip empty/undefined values).
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          result[key] = value;
        }
      });
    }

    const serializedDisabledFeatures = disabledFeatures
      ?.filter(
        (feature, index, features) => features.indexOf(feature) === index,
      )
      .join(',');
    if (serializedDisabledFeatures) {
      result[TRADING_VIEW_DISABLED_FEATURES_URL_PARAM] =
        serializedDisabledFeatures;
    }

    return result;
  }, [additionalParams, calendars, disabledFeatures, systemLocale, theme]);

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
    params,
  };
}
