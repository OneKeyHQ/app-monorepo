import { useCallback, useMemo, useRef } from 'react';

import { useCalendars } from 'expo-localization';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { TRADING_VIEW_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { getTradingViewTimezone } from '../utils/tradingViewTimezone';

import { useTradeUpdates } from './hooks';
import { usePerpsMessageHandler } from './messageHandlers';

import type { ITradeEvent } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';

interface IBaseTradingViewPerpsV2Props {
  symbol: string;
  userAddress: IHex | undefined;
  onLoadEnd?: () => void;
  onTradeUpdate?: (trade: ITradeEvent) => void;
  tradingViewUrl?: string;
}

export type ITradingViewPerpsV2Props = IBaseTradingViewPerpsV2Props &
  IStackStyle;

export function TradingViewPerpsV2(
  props: ITradingViewPerpsV2Props & WebViewProps,
) {
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;
  const webRef = useRef<IWebViewRef | null>(null);
  const calendars = useCalendars();
  const systemLocale = useLocaleVariant();
  const theme = useThemeVariant();
  const [devSettings] = useDevSettingsPersistAtom();

  const { symbol, userAddress, onLoadEnd, onTradeUpdate, tradingViewUrl } =
    props;

  // build TradingView URL
  const finalTradingViewUrl = useMemo(() => {
    const baseUrl =
      tradingViewUrl ||
      (devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl
        ? 'http://localhost:5173/'
        : TRADING_VIEW_URL);

    const url = new URL(baseUrl);
    url.searchParams.set('timezone', getTradingViewTimezone(calendars));
    url.searchParams.set('locale', systemLocale);
    url.searchParams.set('platform', platformEnv.appPlatform ?? 'web');
    url.searchParams.set('theme', theme);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('type', 'perps');

    return url.toString();
  }, [tradingViewUrl, devSettings, calendars, systemLocale, theme, symbol]);

  const { customReceiveHandler } = usePerpsMessageHandler({
    symbol,
    userAddress,
    webRef,
  });

  // trade update push
  const { pushTradeUpdate: _pushTradeUpdate } = useTradeUpdates({
    webRef,
    onTradeUpdate,
  });

  const onWebViewRef = useCallback((ref: IWebViewRef | null) => {
    webRef.current = ref;
  }, []);

  return (
    <Stack position="relative" flex={1}>
      <WebView
        src={finalTradingViewUrl}
        customReceiveHandler={customReceiveHandler}
        onWebViewRef={onWebViewRef}
        onLoadEnd={onLoadEnd}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
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
