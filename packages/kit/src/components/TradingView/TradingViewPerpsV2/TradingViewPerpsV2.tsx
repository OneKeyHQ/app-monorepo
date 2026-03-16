import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  useTradingFormEnvAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCandlesWebviewMountedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { useNavigationHandler, useTradingViewUrl } from '../hooks';

import { useChartLines, useTradeUpdates } from './hooks';
import { usePerpsTradingViewMessageHandler } from './messageHandlers';

import type { ITVOrderCancelPayload, ITradeEvent } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IBaseTradingViewPerpsV2Props {
  symbol: string;
  userAddress: IHex | undefined | null;
  webviewKey?: string;
  onLoadEnd?: () => void;
  onTradeUpdate?: (trade: ITradeEvent) => void;
  onTouchScroll?: (deltaY: number) => void;
}

export type ITradingViewPerpsV2Props = IBaseTradingViewPerpsV2Props &
  IStackStyle;

// Dynamic params sync hook - symbol changes sync via message instead of WebView reload
const useSymbolSync = ({
  webRef,
  symbol,
  isChartReady,
}: {
  webRef: React.RefObject<IWebViewRef | null>;
  symbol: string;
  isChartReady: boolean;
}) => {
  const prevSymbolRef = useRef<string>(symbol);

  useEffect(() => {
    const prevSymbol = prevSymbolRef.current;
    const hasSymbolChanged = prevSymbol !== symbol;

    if (hasSymbolChanged && webRef.current) {
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

  // Re-sync symbol when chart becomes ready to catch messages lost during iframe load
  useEffect(() => {
    if (isChartReady && webRef.current) {
      webRef.current.sendMessageViaInjectedScript({
        type: 'SYMBOL_CHANGE',
        payload: {
          symbol,
          force: false,
        },
      });
    }
  }, [isChartReady, symbol, webRef]);
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
  const {
    symbol,
    userAddress,
    onLoadEnd,
    onTradeUpdate,
    onTouchScroll,
    webviewKey,
    ...stackStyle
  } = props;
  const [, setMounted] = usePerpsCandlesWebviewMountedAtom();
  const webRef = useRef<IWebViewRef | null>(null);
  const theme = useThemeVariant();
  const actions = useHyperliquidActions();

  // Chart lines state
  const [isChartLinesReady, setIsChartLinesReady] = useState(false);
  const [{ szDecimals }] = useTradingFormEnvAtom();
  const _webviewKey = useMemo(() => {
    return `${theme}-${webviewKey || ''}`;
  }, [theme, webviewKey]);

  // Track webviewKey changes and reset isChartLinesReady when it changes
  const prevWebviewKeyRef = useRef(_webviewKey);
  useEffect(() => {
    if (prevWebviewKeyRef.current !== _webviewKey) {
      // WebView will reload due to key change, reset ready state
      setIsChartLinesReady(false);
      prevWebviewKeyRef.current = _webviewKey;
    }
  }, [_webviewKey]);

  useEffect(() => {
    setMounted({ mounted: true });
    return () => {
      setMounted({ mounted: false });
    };
  }, [setMounted]);

  // Freeze initial symbol to prevent URL regeneration on symbol changes
  const initialSymbolRef = useRef(symbol);

  const { handleNavigation } = useNavigationHandler();

  // Optimization: Static URL with only initialization params to avoid WebView reload
  // Memoize additionalParams to prevent useTradingViewUrl from regenerating URL
  const additionalParams = useMemo(
    () => ({
      symbol: initialSymbolRef.current, // Use frozen initial symbol
      type: 'perps' as const,
      storageNamespace: 'perps' as const,
    }),
    // Empty deps: only regenerate when component mounts or webviewKey changes (via external reloadHook)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_webviewKey],
  );

  useEffect(() => {
    initialSymbolRef.current = symbol;
  }, [symbol]);

  const { finalUrl: staticTradingViewUrl } = useTradingViewUrl({
    additionalParams,
  });

  // Optimization: Dynamic symbol parameter sync mechanism
  useSymbolSync({
    webRef,
    symbol,
    isChartReady: isChartLinesReady,
  });

  // Callback when TradingView iframe signals chart lines are ready
  const onChartLinesReady = useCallback(() => {
    setIsChartLinesReady(true);
  }, []);

  // Callback when user clicks cancel button on order line in TradingView chart
  const onOrderCancel = useCallback(
    async (payload: ITVOrderCancelPayload) => {
      const { symbol: orderSymbol, orderId } = payload;

      if (!orderId) {
        console.warn('[TradingViewPerpsV2] Order cancel: missing orderId');
        return;
      }

      try {
        // Ensure trading is enabled before canceling
        await actions.current.ensureTradingEnabled();

        // Get symbol metadata to obtain assetId
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
            coin: orderSymbol,
          });

        if (!symbolMeta) {
          console.warn(
            '[TradingViewPerpsV2] Token info not found for coin:',
            orderSymbol,
          );
          return;
        }

        // Cancel the order
        await actions.current.cancelOrder({
          orders: [
            {
              assetId: symbolMeta.assetId,
              oid: parseInt(orderId, 10),
            },
          ],
        });
      } catch (error) {
        console.error('[TradingViewPerpsV2] Failed to cancel order:', error);
      }
    },
    [actions],
  );

  const { customReceiveHandler } = usePerpsTradingViewMessageHandler({
    symbol,
    userAddress,
    webRef,
    onChartLinesReady,
    onOrderCancel,
    onTouchScroll,
  });

  // Chart lines management (liquidation, position, orders)
  useChartLines({
    symbol,
    szDecimals: szDecimals ?? 3,
    userAddress,
    webRef,
    isReady: isChartLinesReady,
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
    <Stack position="relative" flex={1} {...stackStyle}>
      <WebViewMemoized
        key={_webviewKey}
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

      {platformEnv.isNativeIOS ? (
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
