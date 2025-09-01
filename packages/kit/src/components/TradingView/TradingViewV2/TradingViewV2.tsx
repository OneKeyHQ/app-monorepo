import { useCallback, useMemo, useRef } from 'react';

import { useCalendars } from 'expo-localization';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { TRADING_VIEW_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { getTradingViewTimezone } from '../utils/tradingViewTimezone';

import {
  useAutoKLineUpdate,
  useAutoTokenDetailUpdate,
  useNavigationHandler,
} from './hooks';
import { useTradingViewMessageHandler } from './messageHandlers';

import type { ICustomReceiveHandlerData } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IBaseTradingViewV2Props {
  mode: 'overview' | 'realtime';
  identifier: string;
  symbol: string;
  targetToken: string;
  onLoadEnd: () => void;
  tradingViewUrl?: string;
  tokenAddress?: string;
  networkId?: string;
  interval?: string;
  timeFrom?: number;
  timeTo?: number;
  decimal: number;
  onPanesCountChange?: (count: number) => void;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export function TradingViewV2(props: ITradingViewV2Props & WebViewProps) {
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;
  const webRef = useRef<IWebViewRef | null>(null);
  const calendars = useCalendars();
  const systemLocale = useLocaleVariant();
  const theme = useThemeVariant();
  const [devSettings] = useDevSettingsPersistAtom();

  const {
    mode,
    onLoadEnd,
    tradingViewUrl,
    tokenAddress = '',
    networkId = '',
    symbol,
    decimal,
    onPanesCountChange,
  } = props;

  const { handleNavigation } = useNavigationHandler();
  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress,
    networkId,
    webRef,
    onPanesCountChange,
  });

  // Determine the URL to use based on dev settings
  const finalTradingViewUrl = useMemo(() => {
    if (tradingViewUrl) {
      return tradingViewUrl;
    }

    return devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl
      ? 'http://localhost:5173/'
      : TRADING_VIEW_URL;
  }, [
    tradingViewUrl,
    devSettings.enabled,
    devSettings.settings?.useLocalTradingViewUrl,
  ]);

  const tradingViewUrlWithParams = useMemo(() => {
    const timezone = getTradingViewTimezone(calendars);
    const locale = systemLocale;

    const url = new URL(finalTradingViewUrl);
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('locale', locale);
    url.searchParams.set('platform', platformEnv.appPlatform ?? 'web');
    url.searchParams.set('theme', theme);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('decimal', decimal?.toString());
    url.searchParams.set('networkId', networkId);
    url.searchParams.set('address', tokenAddress);
    return url.toString();
  }, [
    finalTradingViewUrl,
    calendars,
    systemLocale,
    theme,
    symbol,
    decimal,
    networkId,
    tokenAddress,
  ]);

  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: mode === 'realtime',
  });

  useAutoTokenDetailUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: mode === 'realtime',
  });

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  return (
    <Stack position="relative" flex={1}>
      <WebView
        customReceiveHandler={async (data) => {
          await customReceiveHandler(data as ICustomReceiveHandlerData);
        }}
        onLoadEnd={onLoadEnd}
        onWebViewRef={(ref) => {
          webRef.current = ref;
        }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        src={tradingViewUrlWithParams}
      />

      {platformEnv.isNativeIOS || isIPadPortrait ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={12}
          zIndex={1}
          pointerEvents="auto"
        />
      ) : null}
    </Stack>
  );
}
