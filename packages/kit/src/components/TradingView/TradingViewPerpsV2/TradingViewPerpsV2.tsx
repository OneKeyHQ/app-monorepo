import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

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

import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';

interface IBaseTradingViewPerpsV2Props {
  symbol: string;
  onLoadEnd?: () => void;
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

  const { symbol, onLoadEnd, tradingViewUrl } = props;

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

  // Optimization: Static URL with only initialization params to avoid WebView reload
  const staticTradingViewUrl = useMemo(() => {
    const timezone = getTradingViewTimezone(calendars);
    const locale = systemLocale;

    const url = new URL(finalTradingViewUrl);
    // Only set initialization params that don't change frequently
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('locale', locale);
    url.searchParams.set('platform', platformEnv.appPlatform ?? 'web');
    url.searchParams.set('theme', theme);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('type', 'perps');

    return url.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalTradingViewUrl, calendars, systemLocale, theme]);

  // Optimization: Dynamic symbol parameter sync mechanism
  useSymbolSync({
    webRef,
    symbol,
  });

  // Stabilize callback functions
  const onWebViewRef = useCallback((ref: IWebViewRef | null) => {
    webRef.current = ref;
  }, []);

  const customReceiveHandler = useCallback(async (data: any) => {
    console.log('📨 TradingViewPerpsV2 received message:', data);
    // Handle messages from WebView here
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
