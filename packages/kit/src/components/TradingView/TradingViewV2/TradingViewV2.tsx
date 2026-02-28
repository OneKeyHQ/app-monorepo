import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useCurrency } from '../../Currency';
import WebView from '../../WebView';
import { useNavigationHandler, useTradingViewUrl } from '../hooks';

import {
  useAutoKLineUpdate,
  useAutoTokenDetailUpdate,
  useHyperLiquidKlineSource,
  useTradingViewV2WebSocket,
} from './hooks';
import {
  fetchAndSendAccountMarks,
  useTradingViewMessageHandler,
} from './messageHandlers';

import type { IMarksTimeRange } from './messageHandlers';
import type { ICustomReceiveHandlerData } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

const TRADINGVIEW_TIMEZONE_OBSERVER_SCRIPT = `
(function() {
  try {
    if (window.__ONEKEY_TV_TZ_OBSERVER__) return;
    window.__ONEKEY_TV_TZ_OBSERVER__ = true;
    var lastTz = '';
    var isValidTz = function(tz) {
      return typeof tz === 'string' && tz.length > 2 && tz.length < 64;
    };
    var send = function(tz) {
      if (!isValidTz(tz) || tz === lastTz) return;
      lastTz = tz;
      try {
        if (window.$onekey && window.$onekey.$private && window.$onekey.$private.request) {
          window.$onekey.$private.request({
            method: 'tradingview_timezoneUpdate',
            params: { timezone: tz },
          });
          return;
        }
      } catch (e) {}
      try {
        window.postMessage({
          scope: '$private',
          method: 'tradingview_timezoneUpdate',
          data: { timezone: tz },
        }, '*');
      } catch (e) {}
    };
    var sendReady = function() {
      try {
        if (window.$onekey && window.$onekey.$private && window.$onekey.$private.request) {
          window.$onekey.$private.request({
            method: 'tradingview_timezoneObserverReady',
            params: {
              href: window.location.href,
              hasWidget: !!resolveWidget(),
            },
          });
        }
      } catch (e) {}
    };
    var findWidgetInWindow = function(win, depth) {
      if (!win || depth > 3) return null;
      try {
        for (var k in win) {
          try {
            var v = win[k];
            if (v && typeof v.activeChart === 'function') return v;
          } catch (e) {}
        }
      } catch (e) {}
      try {
        if (win.frames && win.frames.length) {
          for (var i = 0; i < win.frames.length; i++) {
            var child = win.frames[i];
            var found = findWidgetInWindow(child, depth + 1);
            if (found) return found;
          }
        }
      } catch (e) {}
      return null;
    };
    var resolveWidget = function() {
      try {
        if (window.tvWidget && window.tvWidget.activeChart) return window.tvWidget;
        if (window._tvWidget && window._tvWidget.activeChart) return window._tvWidget;
        if (window.__tvWidget && window.__tvWidget.activeChart) return window.__tvWidget;
        if (window.__charting_library_widget && window.__charting_library_widget.activeChart) {
          return window.__charting_library_widget;
        }
      } catch (e) {}
      return findWidgetInWindow(window, 0);
    };
    var getTimezoneFromWidget = function() {
      try {
        var widget = resolveWidget();
        if (!widget || typeof widget.activeChart !== 'function') return '';
        if (widget._options && widget._options.timezone) return widget._options.timezone;
        if (widget.options && widget.options.timezone) return widget.options.timezone;
        var chart = widget.activeChart();
        if (chart && typeof chart.getTimezone === 'function') {
          return chart.getTimezone();
        }
        if (chart && typeof chart.timezone === 'function') {
          return chart.timezone();
        }
        if (chart && chart._timezone) return chart._timezone;
      } catch (e) {}
      return '';
    };
    var subscribed = false;
    var subscribeTimezoneChange = function() {
      try {
        var widget = resolveWidget();
        if (!widget || typeof widget.activeChart !== 'function') return;
        var doSubscribe = function() {
          if (subscribed) return;
          subscribed = true;
          var chart = widget.activeChart();
          if (!chart) return;
          if (chart.onTimezoneChanged && typeof chart.onTimezoneChanged === 'function') {
            var handler = chart.onTimezoneChanged();
            if (handler && typeof handler.subscribe === 'function') {
              handler.subscribe(null, function(tz) {
                send(tz);
              });
            }
          }
          var tz = getTimezoneFromWidget();
          if (tz) send(tz);
        };
        if (typeof widget.onChartReady === 'function') {
          widget.onChartReady(function() {
            doSubscribe();
          });
        } else {
          doSubscribe();
        }
      } catch (e) {}
    };
    var extractFromJson = function(obj, depth) {
      if (!obj || depth > 6) return '';
      if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
          var r = extractFromJson(obj[i], depth + 1);
          if (r) return r;
        }
        return '';
      }
      if (typeof obj === 'object') {
        for (var k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            if (k.toLowerCase() === 'timezone' && typeof obj[k] === 'string') {
              return obj[k];
            }
          }
        }
        for (var k2 in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k2)) {
            var r2 = extractFromJson(obj[k2], depth + 1);
            if (r2) return r2;
          }
        }
      }
      return '';
    };
    var tryExtract = function(value) {
      if (!value || typeof value !== 'string') return '';
      if (value.indexOf('timezone') === -1 && value.indexOf('Timezone') === -1) return '';
      try {
        var parsed = JSON.parse(value);
        return extractFromJson(parsed, 0) || '';
      } catch (e) {
        var match = value.match(/timezone\\W{0,4}([A-Za-z_]+\\/[A-Za-z_]+|Etc\\/UTC|UTC|GMT[+-]\\d+)/);
        if (match && match[1]) return match[1];
      }
      return '';
    };
    var extractTimezoneFromText = function(text) {
      if (!text || typeof text !== 'string') return '';
      var trimmed = text.trim();
      if (!trimmed) return '';
      var match =
        trimmed.match(/\\b(Etc\\/UTC|UTC|GMT[+-]\\d{1,2}(?::?\\d{2})?|[A-Za-z_]+\\/[A-Za-z_]+)\\b/);
      if (match && match[1]) return match[1];
      return '';
    };
    var handleClick = function(event) {
      try {
        var target = event && event.target;
        if (!target || !target.textContent) return;
        var tz = extractTimezoneFromText(target.textContent);
        if (tz) send(tz);
      } catch (e) {}
    };
    try {
      document.addEventListener('click', handleClick, true);
    } catch (e) {}
    var handleMessage = function(event) {
      try {
        var data = event && event.data;
        var tz = '';
        if (typeof data === 'string') {
          tz = tryExtract(data);
        } else if (data && typeof data === 'object') {
          try {
            tz = extractFromJson(data, 0) || '';
          } catch (e) {}
        }
        if (tz) send(tz);
      } catch (e) {}
    };
    try {
      window.addEventListener('message', handleMessage);
    } catch (e) {}
    var hookFetch = function() {
      try {
        var originalFetch = window.fetch;
        if (typeof originalFetch !== 'function') return;
        window.fetch = function() {
          try {
            var args = arguments;
            if (args && args[1] && args[1].body && typeof args[1].body === 'string') {
              var tz = tryExtract(args[1].body);
              if (tz) send(tz);
            }
          } catch (e) {}
          return originalFetch.apply(this, arguments);
        };
      } catch (e) {}
    };
    var hookXhr = function() {
      try {
        var origOpen = XMLHttpRequest.prototype.open;
        var origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function() {
          this.__onekey_tz_url = arguments[1];
          return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function(body) {
          try {
            if (body && typeof body === 'string') {
              var tz = tryExtract(body);
              if (tz) send(tz);
            }
          } catch (e) {}
          return origSend.apply(this, arguments);
        };
      } catch (e) {}
    };
    var scanStorage = function() {
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          var val = localStorage.getItem(key);
          var tz = tryExtract(val);
          if (tz) {
            send(tz);
            return;
          }
        }
        for (var j = 0; j < sessionStorage.length; j++) {
          var key2 = sessionStorage.key(j);
          var val2 = sessionStorage.getItem(key2);
          var tz2 = tryExtract(val2);
          if (tz2) {
            send(tz2);
            return;
          }
        }
        if (!subscribed) {
          subscribeTimezoneChange();
        } else {
          var tzFromWidget = getTimezoneFromWidget();
          if (tzFromWidget) {
            send(tzFromWidget);
          }
        }
      } catch (e) {}
    };
    var hookStorage = function() {
      try {
        var original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) {
          original.apply(this, arguments);
          var tz = tryExtract(v);
          if (tz) send(tz);
        };
      } catch (e) {}
    };
    hookStorage();
    hookFetch();
    hookXhr();
    subscribeTimezoneChange();
    sendReady();
    scanStorage();
    setInterval(scanStorage, 3000);
  } catch (e) {}
})();
`;

interface IBaseTradingViewV2Props {
  symbol: string;
  tokenAddress?: string;
  networkId?: string;
  decimal: number;
  onPanesCountChange?: (count: number) => void;
  dataSource?: 'websocket' | 'polling';
  accountAddress?: string;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export const TradingViewV2 = (props: ITradingViewV2Props & WebViewProps) => {
  const webRef = useRef<IWebViewRef | null>(null);
  const marksTimeRange = useRef<IMarksTimeRange | null>(null);
  const theme = useThemeVariant();
  const isVisible = useRouteIsFocused();
  const currencyInfo = useCurrency();

  const {
    tokenAddress = '',
    networkId = '',
    symbol,
    decimal,
    onPanesCountChange,
    dataSource,
    accountAddress,
    ...stackStyle
  } = props;

  const { handleNavigation } = useNavigationHandler();
  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress,
    networkId,
    webRef,
    onPanesCountChange,
    accountAddress,
    tokenSymbol: symbol,
    marksTimeRange,
  });

  const { isHyperLiquidSource, symbol: hyperLiquidSymbol } =
    useHyperLiquidKlineSource(networkId, tokenAddress);

  const additionalParams = useMemo(() => {
    const useHyperLiquid = isHyperLiquidSource && hyperLiquidSymbol;
    return {
      decimal: decimal?.toString(),
      networkId,
      address: tokenAddress,
      symbol: useHyperLiquid ? hyperLiquidSymbol : symbol,
      type: useHyperLiquid ? 'perps' : 'market',
      storageNamespace: 'market',
    };
  }, [
    decimal,
    networkId,
    tokenAddress,
    isHyperLiquidSource,
    hyperLiquidSymbol,
    symbol,
  ]);

  const { finalUrl: tradingViewUrlWithParams } = useTradingViewUrl({
    additionalParams,
  });

  // Disable OneKey data hooks when using HyperLiquid source
  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible && dataSource !== 'websocket' && !isHyperLiquidSource,
  });

  useAutoTokenDetailUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible && !isHyperLiquidSource,
  });

  useTradingViewV2WebSocket({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible && dataSource === 'websocket' && !isHyperLiquidSource,
    chartType: '1m',
    currency: currencyInfo.id,
  });

  // Load marks on page enter and refresh when swap transaction succeeds
  useEffect(() => {
    if (!isVisible || !accountAddress || !tokenAddress || !networkId) return;

    const refreshMarks = () => {
      const now = Math.floor(Date.now() / 1000);

      // Use the tracked time range if available, otherwise default to recent period
      const timeRange = marksTimeRange.current || {
        min: now - 86_400 * 30, // Default: 30 days
        max: now,
      };

      void fetchAndSendAccountMarks({
        accountAddress,
        tokenAddress,
        networkId,
        from: timeRange.min,
        to: timeRange.max,
        webRef,
      });
    };

    // Reset time range when token/account changes, then load marks
    marksTimeRange.current = null;
    refreshMarks();

    const handleSwapSuccess = (payload: {
      status: ESwapTxHistoryStatus;
      fromToken?: {
        networkId: string;
        contractAddress?: string;
        address?: string;
      };
      toToken?: {
        networkId: string;
        contractAddress?: string;
        address?: string;
      };
    }) => {
      if (
        payload.status !== ESwapTxHistoryStatus.SUCCESS &&
        payload.status !== ESwapTxHistoryStatus.PARTIALLY_FILLED
      ) {
        return;
      }

      // Check if current token matches fromToken or toToken
      const fromAddr =
        payload.fromToken?.contractAddress || payload.fromToken?.address;
      const toAddr =
        payload.toToken?.contractAddress || payload.toToken?.address;
      const isMatch =
        (payload.fromToken?.networkId === networkId &&
          fromAddr === tokenAddress) ||
        (payload.toToken?.networkId === networkId && toAddr === tokenAddress);

      if (!isMatch) return;

      refreshMarks();
    };

    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapSuccess,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapSuccess,
      );
    };
  }, [isVisible, accountAddress, tokenAddress, networkId, webRef]);

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  const injectTimezoneObserver = useCallback(() => {
    const innerRef = webRef.current?.innerRef as
      | { executeJavaScript?: (code: string) => void }
      | { injectJavaScript?: (code: string) => void }
      | undefined;
    if (!innerRef) return;
    if (typeof (innerRef as any).executeJavaScript === 'function') {
      (innerRef as { executeJavaScript: (code: string) => void }).executeJavaScript(
        TRADINGVIEW_TIMEZONE_OBSERVER_SCRIPT,
      );
      return;
    }
    if (typeof (innerRef as any).injectJavaScript === 'function') {
      (innerRef as { injectJavaScript: (code: string) => void }).injectJavaScript(
        TRADINGVIEW_TIMEZONE_OBSERVER_SCRIPT,
      );
    }
  }, []);

  const webView = useMemo(
    () => (
      <WebView
        key={theme}
        customReceiveHandler={async (data) => {
          await customReceiveHandler(data as ICustomReceiveHandlerData);
        }}
        onWebViewRef={(ref) => {
          webRef.current = ref;
        }}
        allowsBackForwardNavigationGestures={false}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        onLoadEnd={() => {
          injectTimezoneObserver();
        }}
        onDomReady={() => {
          injectTimezoneObserver();
        }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        src={tradingViewUrlWithParams}
      />
    ),
    [
      customReceiveHandler,
      injectTimezoneObserver,
      onShouldStartLoadWithRequest,
      theme,
      tradingViewUrlWithParams,
      webRef,
    ],
  );

  return (
    <Stack position="relative" flex={1} {...stackStyle}>
      {webView}

      {platformEnv.isNativeIOS ? (
        <Stack
          position="absolute"
          left={0}
          top={50}
          bottom={0}
          width={15}
          zIndex={1}
          pointerEvents="auto"
        />
      ) : null}
    </Stack>
  );
};
