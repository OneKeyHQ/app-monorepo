import { useMemo, useRef } from 'react';

import { useCalendars } from 'expo-localization';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { TRADING_VIEW_DISABLED_FEATURES_URL_PARAM } from '../constants';
import { getTradingViewTimezone } from '../utils/tradingViewTimezone';

import type { IWebViewRef } from '../../WebView/types';
import type { ITradingViewDisabledFeature } from '../constants';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

interface IUseTradingViewUrlOptions {
  additionalParams?: Record<string, string>;
  disabledFeatures?: readonly ITradingViewDisabledFeature[];
  theme: 'light' | 'dark';
}

export function useTradingViewUrl(options: IUseTradingViewUrlOptions) {
  const { additionalParams, disabledFeatures, theme } = options;

  const calendars = useCalendars();
  const systemLocale = useLocaleVariant();
  const [devSettings] = useDevSettingsPersistAtom();
  const latestThemeRef = useRef(theme);
  latestThemeRef.current = theme;
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

  const finalUrlWithoutTheme = useMemo(() => {
    const locale = systemLocale;

    const url = new URL(baseUrl);
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('locale', locale);
    url.searchParams.set('platform', platformEnv.appPlatform ?? 'web');
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
  }, [additionalParams, baseUrl, disabledFeatures, systemLocale, timezone]);

  // Desktop/native update the loaded chart in place. Keeping the URL stable
  // prevents a theme-only change from navigating or recreating the WebView.
  const urlTheme =
    platformEnv.isDesktop || platformEnv.isNative ? undefined : theme;
  const finalUrl = useMemo(() => {
    const url = new URL(finalUrlWithoutTheme);
    url.searchParams.set('theme', urlTheme ?? latestThemeRef.current);
    return url.toString();
  }, [finalUrlWithoutTheme, urlTheme]);

  return {
    baseUrl,
    finalUrl,
    timezone,
  };
}

export function syncTradingViewTheme(
  webViewRef: IWebViewRef | null,
  theme: 'light' | 'dark',
) {
  if (!webViewRef?.innerRef) {
    return;
  }

  const script = `
    (function() {
      window.__onekeyTradingViewTheme = ${JSON.stringify(theme)};
      var retryCount = 0;
      function applyTheme() {
        var frame = document.querySelector('iframe[id^="tradingview_"]');
        var changeTheme = frame && frame.contentWindow && frame.contentWindow.changeTheme;
        if (typeof changeTheme === 'function') {
          Promise.resolve(
            changeTheme.call(frame.contentWindow, window.__onekeyTradingViewTheme)
          ).catch(function() {});
          return;
        }
        retryCount += 1;
        if (retryCount < 20) {
          setTimeout(applyTheme, 100);
        }
      }
      applyTheme();
    })();
    true;
  `;

  if (platformEnv.isNative) {
    (webViewRef.innerRef as WebView).injectJavaScript(script);
  } else if (platformEnv.isDesktop) {
    void (webViewRef.innerRef as IElectronWebView).executeJavaScript(script);
  }
}
