import { memo, useCallback, useEffect, useRef } from 'react';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { useNavigationHandler, useTradingViewUrl } from '../hooks';

import { useTradeUpdates } from './hooks';
import { usePerpsMessageHandler } from './messageHandlers';

import type { ITradeEvent } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IBaseTradingViewPerpsV2Props {
  symbol: string;
  userAddress: IHex | undefined | null;
  onLoadEnd?: () => void;
  onTradeUpdate?: (trade: ITradeEvent) => void;
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
    onShouldStartLoadWithRequest,
    ...otherProps
  }: {
    src: string;
    customReceiveHandler: (data: any) => Promise<void>;
    onWebViewRef: (ref: IWebViewRef | null) => void;
    onShouldStartLoadWithRequest?: (event: WebViewNavigation) => boolean;
    [key: string]: any;
  }) => (
    <WebView
      src={src}
      customReceiveHandler={customReceiveHandler}
      onWebViewRef={onWebViewRef}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      {...otherProps}
    />
  ),
  (prevProps, nextProps) => {
    // Only re-render if critical props change
    return (
      prevProps.src === nextProps.src &&
      prevProps.customReceiveHandler === nextProps.customReceiveHandler &&
      prevProps.onShouldStartLoadWithRequest ===
        nextProps.onShouldStartLoadWithRequest
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
  const theme = useThemeVariant();

  const { symbol, userAddress, onLoadEnd, onTradeUpdate } = props;

  const { handleNavigation } = useNavigationHandler();

  // Optimization: Static URL with only initialization params to avoid WebView reload
  const { finalUrl: staticTradingViewUrl } = useTradingViewUrl({
    additionalParams: {
      symbol,
      type: 'perps',
    },
  });

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

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  return (
    <Stack position="relative" flex={1}>
      <WebViewMemoized
        key={theme}
        src={staticTradingViewUrl}
        customReceiveHandler={customReceiveHandler}
        onWebViewRef={onWebViewRef}
        onLoadEnd={onLoadEnd}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        allowsBackForwardNavigationGestures={false}
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
