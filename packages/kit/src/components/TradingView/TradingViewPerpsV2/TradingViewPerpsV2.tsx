import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

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

// Dynamic params sync hook - symbol changes sync via message instead of WebView reload
const useSymbolSync = ({
  webRef,
  symbol,
}: {
  webRef: React.RefObject<IWebViewRef | null>;
  symbol: string;
}) => {
  const prevSymbolRef = useRef<string>(symbol);

  useEffect(() => {
    const prevSymbol = prevSymbolRef.current;
    const hasSymbolChanged = prevSymbol !== symbol;

    if (hasSymbolChanged && webRef.current) {
      console.log('🔄 Syncing symbol to WebView:', {
        from: prevSymbol,
        to: symbol,
      });

      // Sync symbol changes via message communication instead of WebView reload
      webRef.current.sendMessageViaInjectedScript({
        type: 'SYMBOL_CHANGE',
        payload: {
          symbol,
          force: true,
        },
      });

      prevSymbolRef.current = symbol;
    }
  }, [symbol, webRef]);
};

// WebView Memoized component to prevent unnecessary re-renders
const WebViewMemoized = memo(
  ({
    src,
    customReceiveHandler,
    onWebViewRef,
    ...otherProps
  }: {
    src: string;
    customReceiveHandler: (data: any) => Promise<void>;
    onWebViewRef: (ref: IWebViewRef | null) => void;
    [key: string]: any;
  }) => (
    <WebView
      src={src}
      customReceiveHandler={customReceiveHandler}
      onWebViewRef={onWebViewRef}
      {...otherProps}
    />
  ),
  (prevProps, nextProps) => {
    // Only re-render if critical props change
    return (
      prevProps.src === nextProps.src &&
      prevProps.customReceiveHandler === nextProps.customReceiveHandler
    );
  },
);

WebViewMemoized.displayName = 'WebViewMemoized';

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

  // Optimization: Static URL with only initialization params to avoid WebView reload
  const staticTradingViewUrl = useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradingViewUrl, devSettings, calendars, systemLocale, theme]);

  // Optimization: Dynamic symbol parameter sync mechanism
  useSymbolSync({
    webRef,
    symbol,
  });

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
      <WebViewMemoized
        src={staticTradingViewUrl}
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
