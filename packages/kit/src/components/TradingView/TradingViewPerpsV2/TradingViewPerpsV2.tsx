import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { LottieView, Stack, useTheme } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import TradingViewChartLoadingAnimation from '@onekeyhq/kit/assets/animations/swap_order_pending.json';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  useTradingFormEnvAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { showSetTpslDialog } from '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/SetTpslModal';
import { showLimitOrderDialog } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/panels/LimitOrderForm';
import { usePerpsCandlesWebviewMountedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useNetworkRestore } from '../../../hooks/useNetworkRestore';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { useNavigationHandler, useTradingViewUrl } from '../hooks';

import { MESSAGE_TYPES } from './constants/messageTypes';
import { useChartLines, useTradeUpdates } from './hooks';
import { usePerpsTradingViewMessageHandler } from './messageHandlers';

import type {
  ITVChartOrderIntentPayload,
  ITVOrderCancelPayload,
  ITVOrderDraftCreatePayload,
  ITVOrderPriceUpdatePayload,
  ITradeEvent,
} from './types';
import type { IWebViewProps } from '../../WebView';
import type { IWebViewRef } from '../../WebView/types';
import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IBaseTradingViewPerpsV2Props {
  symbol: string;
  // Spot-only normalized labels; perp omits and the TV side falls back to symbol.
  displayPair?: string;
  displayCoin?: string;
  userAddress: IHex | undefined | null;
  enablePerpsTradingUi?: boolean;
  webviewKey?: string;
  reloadOnSymbolChange?: boolean;
  collapseChartExpandSignal?: number;
  onLoadEnd?: () => void;
  onTradeUpdate?: (trade: ITradeEvent) => void;
  onTouchScroll?: (deltaY: number) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
}

export type ITradingViewPerpsV2Props = IBaseTradingViewPerpsV2Props &
  IStackStyle;

// Dynamic params sync hook - symbol changes sync via message instead of WebView reload
const useSymbolSync = ({
  webRef,
  symbol,
  displayPair,
  displayCoin,
  isChartReady,
  enabled,
  syncOnReady = enabled,
}: {
  webRef: React.RefObject<IWebViewRef | null>;
  symbol: string;
  displayPair: string | undefined;
  displayCoin: string | undefined;
  isChartReady: boolean;
  enabled: boolean;
  syncOnReady?: boolean;
}) => {
  const prevParamsRef = useRef({
    displayCoin,
    displayPair,
    symbol,
  });
  const readySyncKeyRef = useRef<string | null>(null);

  const sendSymbolChange = useCallback(
    ({ force }: { force: boolean }) => {
      webRef.current?.sendMessageViaInjectedScript({
        type: 'SYMBOL_CHANGE',
        payload: {
          symbol,
          displayPair,
          displayCoin,
          force,
        },
      });
    },
    [displayCoin, displayPair, symbol, webRef],
  );

  useEffect(() => {
    if (!enabled) {
      prevParamsRef.current = {
        displayCoin,
        displayPair,
        symbol,
      };
      return;
    }

    const prevParams = prevParamsRef.current;
    const hasSymbolChanged = prevParams.symbol !== symbol;
    const hasDisplayParamsChanged =
      prevParams.displayPair !== displayPair ||
      prevParams.displayCoin !== displayCoin;

    if ((hasSymbolChanged || hasDisplayParamsChanged) && webRef.current) {
      // Sync symbol changes via message communication instead of WebView reload
      sendSymbolChange({ force: hasSymbolChanged });

      prevParamsRef.current = {
        displayCoin,
        displayPair,
        symbol,
      };
    }
  }, [displayCoin, displayPair, enabled, sendSymbolChange, symbol, webRef]);

  // Re-sync symbol when chart becomes ready to catch messages lost during iframe load
  useEffect(() => {
    if (!syncOnReady) {
      readySyncKeyRef.current = null;
      return;
    }

    if (!isChartReady) {
      readySyncKeyRef.current = null;
      return;
    }

    const readySyncKey = `${symbol}:${displayPair ?? ''}:${displayCoin ?? ''}`;
    if (readySyncKeyRef.current === readySyncKey || !webRef.current) {
      return;
    }

    sendSymbolChange({ force: false });
    readySyncKeyRef.current = readySyncKey;
  }, [
    displayCoin,
    displayPair,
    isChartReady,
    sendSymbolChange,
    symbol,
    syncOnReady,
    webRef,
  ]);
};

// WebView Memoized component to prevent unnecessary re-renders
const WebViewMemoized = memo(
  ({
    src,
    customReceiveHandler,
    onWebViewRef,
    onShouldStartLoadWithRequest,
    ...otherProps
  }: Omit<
    IWebViewProps,
    | 'src'
    | 'customReceiveHandler'
    | 'onWebViewRef'
    | 'onShouldStartLoadWithRequest'
  > & {
    src: string;
    customReceiveHandler: IJsBridgeReceiveHandler;
    onWebViewRef: (ref: IWebViewRef | null) => void;
    onShouldStartLoadWithRequest?: (event: WebViewNavigation) => boolean;
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

function TradingViewChartLoading() {
  return (
    <LottieView
      width={110}
      height={110}
      autoPlay
      source={TradingViewChartLoadingAnimation}
    />
  );
}

const hideTradingViewBuiltInLoadingScript = `
  ;(function() {
    var styleText = [
      '#loading-indicator',
      '.loading-indicator',
      '.tv-spinner',
      '.spinner.tv-spinner'
    ].join(',') + '{display:none!important;visibility:hidden!important;opacity:0!important;}';

    function applyStyle(doc) {
      try {
        if (!doc || !doc.documentElement) {
          return;
        }
        if (!doc.getElementById('onekey-hide-tradingview-loading')) {
          var style = doc.createElement('style');
          style.id = 'onekey-hide-tradingview-loading';
          style.textContent = styleText;
          doc.documentElement.appendChild(style);
        }
      } catch (error) {
        // noop
      }
    }

    function applyToFrames() {
      applyStyle(document);
      try {
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i += 1) {
          var frame = frames[i];
          applyStyle(frame.contentDocument);
        }
      } catch (error) {
        // noop
      }
    }

    applyToFrames();
    var observer = new MutationObserver(applyToFrames);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    var intervalId = setInterval(applyToFrames, 100);
    setTimeout(function() {
      clearInterval(intervalId);
      observer.disconnect();
    }, 5000);
  })();
  true;
`;

export function TradingViewPerpsV2(
  props: ITradingViewPerpsV2Props & WebViewProps,
) {
  const {
    symbol,
    displayPair,
    displayCoin,
    userAddress,
    enablePerpsTradingUi = false,
    reloadOnSymbolChange = false,
    collapseChartExpandSignal,
    onLoadEnd,
    onTradeUpdate,
    onTouchScroll,
    onInteractionOverlayOpenChange,
    webviewKey,
    ...stackStyle
  } = props;
  const [, setMounted] = usePerpsCandlesWebviewMountedAtom();
  const webRef = useRef<IWebViewRef | null>(null);
  const theme = useThemeVariant();
  const themeColors = useTheme();
  const tradingViewBackgroundColor = themeColors.bgApp.val;
  const actions = useHyperliquidActions();
  const intl = useIntl();
  const { restoreNonce } = useNetworkRestore();

  const [{ szDecimals }] = useTradingFormEnvAtom();
  const _webviewKey = useMemo(() => {
    return `${theme}-${webviewKey || ''}${
      reloadOnSymbolChange ? `-${symbol}` : ''
    }`;
  }, [reloadOnSymbolChange, symbol, theme, webviewKey]);
  const [chartLinesReadyWebviewKey, setChartLinesReadyWebviewKey] = useState<
    string | null
  >(null);
  const [chartContentReadyWebviewKey, setChartContentReadyWebviewKey] =
    useState<string | null>(null);
  const hasPerpsReadyRef = useRef(false);
  const lastHandledRestoreNonceRef = useRef(0);

  const isChartLinesReady = chartLinesReadyWebviewKey === _webviewKey;
  const isChartContentReady = chartContentReadyWebviewKey === _webviewKey;

  const prevWebviewKeyRef = useRef(_webviewKey);
  useEffect(() => {
    if (prevWebviewKeyRef.current !== _webviewKey) {
      // A new WebView instance must prove perpsReady before app-side recovery
      // can stay hands-off.
      hasPerpsReadyRef.current = false;
      setChartLinesReadyWebviewKey(null);
      setChartContentReadyWebviewKey(null);
      prevWebviewKeyRef.current = _webviewKey;
    }
  }, [_webviewKey]);

  useEffect(() => {
    setMounted({ mounted: true });
    return () => {
      setMounted({ mounted: false });
    };
  }, [setMounted]);

  const { handleNavigation } = useNavigationHandler();

  // Optimization: Static URL with only initialization params to avoid WebView reload
  // Memoize additionalParams to prevent useTradingViewUrl from regenerating URL
  const staticUrlSymbol = useMemo(
    () => symbol,
    // Symbol-only changes are sent through SYMBOL_CHANGE. Recompute only when
    // the WebView is intentionally re-keyed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_webviewKey],
  );
  const urlSymbol = reloadOnSymbolChange ? symbol : staticUrlSymbol;
  const additionalParams = useMemo(
    () => ({
      symbol: urlSymbol,
      type: 'perps' as const,
      storageNamespace: 'perps' as const,
      enablePerpsTradingUi: enablePerpsTradingUi ? '1' : '0',
    }),
    [enablePerpsTradingUi, urlSymbol],
  );

  const { finalUrl: staticTradingViewUrl } = useTradingViewUrl({
    additionalParams,
  });
  const isSpotDisplayNameSyncRequired =
    reloadOnSymbolChange && (!!displayPair || !!displayCoin);
  const tradingViewWebViewStyleProps = useMemo(
    () => ({
      containerStyle: { backgroundColor: tradingViewBackgroundColor },
      style: { backgroundColor: tradingViewBackgroundColor },
    }),
    [tradingViewBackgroundColor],
  );

  // Optimization: Dynamic symbol parameter sync mechanism
  useSymbolSync({
    webRef,
    symbol,
    displayPair,
    displayCoin,
    isChartReady: reloadOnSymbolChange
      ? isChartContentReady
      : isChartLinesReady,
    enabled: !reloadOnSymbolChange,
    syncOnReady: !reloadOnSymbolChange || isSpotDisplayNameSyncRequired,
  });

  const processedCollapseChartExpandSignalRef = useRef(0);

  useEffect(() => {
    if (
      !collapseChartExpandSignal ||
      collapseChartExpandSignal ===
        processedCollapseChartExpandSignalRef.current
    ) {
      return;
    }

    if (!isChartContentReady || !webRef.current) {
      return;
    }

    processedCollapseChartExpandSignalRef.current = collapseChartExpandSignal;

    const syncChartCollapsed = () => {
      webRef.current?.sendMessageViaInjectedScript({
        type: MESSAGE_TYPES.PERPS_TV_CHART_EXPAND_SYNC,
        payload: { expanded: false },
      });
    };

    syncChartCollapsed();
    const retryTimer = setTimeout(syncChartCollapsed, 250);

    return () => {
      clearTimeout(retryTimer);
    };
  }, [collapseChartExpandSignal, isChartContentReady]);

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

  useEffect(() => {
    if (restoreNonce <= 0) {
      return;
    }
    if (lastHandledRestoreNonceRef.current === restoreNonce) {
      return;
    }

    lastHandledRestoreNonceRef.current = restoreNonce;

    if (!hasPerpsReadyRef.current) {
      setChartLinesReadyWebviewKey(null);
      setChartContentReadyWebviewKey(null);
      webRef.current?.reload();
    }
  }, [restoreNonce]);

  const onChartLinesReady = useCallback(() => {
    hasPerpsReadyRef.current = true;
    setChartContentReadyWebviewKey(_webviewKey);
    setChartLinesReadyWebviewKey(_webviewKey);
  }, [_webviewKey]);

  const onChartReady = useCallback(() => {
    setChartContentReadyWebviewKey(_webviewKey);
  }, [_webviewKey]);

  const onOrderCancel = useCallback(
    async (payload: ITVOrderCancelPayload) => {
      const oid = Number.parseInt(payload.orderId ?? '', 10);
      if (!Number.isFinite(oid)) return;
      if (!enablePerpsTradingUi) return;

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
    [actions, enablePerpsTradingUi],
  );

  const onOrderDraftCreate = useCallback(
    (_payload: ITVOrderDraftCreatePayload) => {
      // No-op kept for version skew: an old chart still emitting the legacy
      // method must not place an order (placement moved to onChartOrderIntent).
    },
    [],
  );

  const onChartOrderIntent = useCallback(
    async (payload: ITVChartOrderIntentPayload) => {
      if (!enablePerpsTradingUi) return;

      // Fire-and-forget handler: self-own errors to avoid unhandled rejections.
      try {
        if (payload.intent === 'limitEntry') {
          const isCurrentSymbolIntent = payload.symbol === symbol;
          showLimitOrderDialog({
            symbol: payload.symbol,
            price: payload.price,
            displayPair: isCurrentSymbolIntent ? displayPair : undefined,
            displayCoin: isCurrentSymbolIntent ? displayCoin : undefined,
            intl,
          });
          return;
        }
        if (payload.intent === 'positionTpSl') {
          const meta =
            await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
              coin: payload.symbol,
            });
          if (!meta) return;
          showSetTpslDialog({
            coin: payload.symbol,
            szDecimals: meta.universe?.szDecimals ?? 0,
            assetId: meta.assetId,
            presetTriggerPrice: payload.price,
            presetTpsl: payload.tpsl,
            intl,
          });
        }
      } catch (error) {
        console.error('[TradingViewPerpsV2] onChartOrderIntent failed:', error);
      }
    },
    [displayCoin, displayPair, enablePerpsTradingUi, intl, symbol],
  );

  const onOrderPriceUpdate = useCallback(
    async (payload: ITVOrderPriceUpdatePayload) => {
      const oid = Number.parseInt(payload.orderId ?? '', 10);
      if (!Number.isFinite(oid)) return;
      if (!enablePerpsTradingUi) {
        webRef.current?.sendMessageViaInjectedScript({
          type: MESSAGE_TYPES.PERPS_TV_ORDER_PRICE_UPDATE_REJECTED,
          payload: {
            requestId: payload.requestId,
            lineId: payload.lineId,
            symbol: payload.symbol,
            orderId: payload.orderId,
          },
        });
        return;
      }

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
    [actions, enablePerpsTradingUi, webRef],
  );

  const { customReceiveHandler } = usePerpsTradingViewMessageHandler({
    symbol,
    userAddress,
    webRef,
    onChartReady,
    onChartLinesReady,
    onOrderCancel,
    onOrderDraftCreate,
    onOrderPriceUpdate,
    onChartOrderIntent,
    onTouchScroll,
    onInteractionOverlayOpenChange,
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
  const showChartLoadingMask = !isChartContentReady;

  return (
    <Stack position="relative" flex={1} {...stackStyle}>
      <WebViewMemoized
        key={_webviewKey}
        src={staticTradingViewUrl}
        containerProps={{ bg: '$bgApp' }}
        containerStyle={tradingViewWebViewStyleProps.containerStyle}
        style={tradingViewWebViewStyleProps.style}
        customReceiveHandler={customReceiveHandler}
        onWebViewRef={onWebViewRef}
        onLoadEnd={onLoadEnd}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        nativeInjectedJavaScriptBeforeContentLoaded={
          platformEnv.isNativeAndroid
            ? hideTradingViewBuiltInLoadingScript
            : undefined
        }
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

      {showChartLoadingMask ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          right={0}
          bottom={0}
          zIndex={2}
          bg="$bgApp"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <TradingViewChartLoading />
        </Stack>
      ) : null}

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
