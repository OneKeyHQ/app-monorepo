import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  useTradingFormEnvAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  EActionType,
  withToast,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils';
import { usePerpsCandlesWebviewMountedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { useNavigationHandler, useTradingViewUrl } from '../hooks';

import { MESSAGE_TYPES } from './constants/messageTypes';
import { useChartLines, useTradeUpdates } from './hooks';
import { usePerpsTradingViewMessageHandler } from './messageHandlers';

import type {
  ITVOrderCancelPayload,
  ITVOrderDraftCreatePayload,
  ITVOrderPriceUpdatePayload,
  ITradeEvent,
} from './types';
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

  const pendingRecoverRef = useRef(false);

  useEffect(() => {
    const handler = () => {
      if (isChartLinesReady && webRef.current) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'FORCE_RECOVER_WS',
        });
      } else {
        pendingRecoverRef.current = true;
      }
    };
    appEventBus.on(EAppEventBusNames.PerpsWebSocketRecovered, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.PerpsWebSocketRecovered, handler);
    };
  }, [isChartLinesReady, webRef]);

  useEffect(() => {
    if (isChartLinesReady && pendingRecoverRef.current) {
      pendingRecoverRef.current = false;
      webRef.current?.sendMessageViaInjectedScript({
        type: 'FORCE_RECOVER_WS',
      });
    }
  }, [isChartLinesReady, webRef]);

  // Callback when TradingView iframe signals chart lines are ready
  const onChartLinesReady = useCallback(() => {
    setIsChartLinesReady(true);
  }, []);

  const onOrderCancel = useCallback(
    async (payload: ITVOrderCancelPayload) => {
      const oid = Number.parseInt(payload.orderId ?? '', 10);
      if (!Number.isFinite(oid)) return;

      // Message handler invokes this without await — swallow rejections to
      // avoid leaking them as unhandled; errors are already surfaced via
      // withToast inside cancelChartOrder / ensureTradingEnabled.
      try {
        await actions.current.ensureTradingEnabled();
        await actions.current.cancelChartOrder({ oid });
      } catch {
        // intentional: toast owns the user-facing message
      }
    },
    [actions],
  );

  const onOrderDraftCreate = useCallback(
    async (payload: ITVOrderDraftCreatePayload) => {
      try {
        await actions.current.ensureTradingEnabled();
        await withToast({
          asyncFn: () =>
            backgroundApiProxy.serviceHyperliquidExchange.placeLimitOrderByCoin(
              {
                coin: payload.symbol,
                isBuy: payload.side === 'buy',
                size: payload.quantity,
                price: payload.price,
              },
            ),
          actionType: EActionType.PLACE_ORDER,
        });
      } catch {
        // intentional: withToast owns the user-facing error message
      }
    },
    [actions],
  );

  const onOrderPriceUpdate = useCallback(
    async (payload: ITVOrderPriceUpdatePayload) => {
      const oid = Number.parseInt(payload.orderId ?? '', 10);
      if (!Number.isFinite(oid)) return;

      try {
        await actions.current.ensureTradingEnabled();
        await actions.current.amendChartOrder({
          coin: payload.symbol,
          oid,
          newPrice: payload.price,
        });
      } catch {
        webRef.current?.sendMessageViaInjectedScript({
          type: MESSAGE_TYPES.PERPS_TV_ORDER_PRICE_UPDATE_REJECTED,
          payload: {
            requestId: payload.requestId,
            lineId: payload.lineId,
            symbol: payload.symbol,
            orderId: payload.orderId,
          },
        });
      }
    },
    [actions, webRef],
  );

  const { customReceiveHandler } = usePerpsTradingViewMessageHandler({
    symbol,
    userAddress,
    webRef,
    onChartLinesReady,
    onOrderCancel,
    onOrderDraftCreate,
    onOrderPriceUpdate,
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
