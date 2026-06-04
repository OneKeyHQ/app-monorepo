import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  type ChartWebviewMethods,
  type ChartWebviewProps,
  ChartWebviewView,
} from '@onekeyfe/react-native-chart-webview';
import { type HybridView, callback } from 'react-native-nitro-modules';

import { Stack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';

import {
  CHART_WEBVIEW_ENTRY,
  CHART_WEBVIEW_LOCAL_BUNDLE,
  CHART_WEBVIEW_MODE,
  CHART_WEBVIEW_POOLED,
  CHART_WEBVIEW_REUSE_KEY,
  CHART_WEBVIEW_SCENE,
  CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS,
  CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL,
} from './constants';

import type { IChartWebViewProps } from './types';
import type { IWebViewRef } from '../../WebView/types';

// Unified scene only applies to the native offline/local bundle (online keys its
// source by URL, which fights the constant-source reuse). Both inputs are module
// constants, so this resolves once.
const IS_UNIFIED =
  CHART_WEBVIEW_MODE !== 'online' && CHART_WEBVIEW_SCENE === 'unified';

// The constant unified source: keep ONLY app-global keys (in a fixed order) and
// inject the fixed unified scene + boot symbol. Token/business-independent and
// deterministic, so market and perps hosts produce a byte-identical source and
// the shared WebView never reloads on switch (per-symbol data rides SYMBOL_CHANGE).
function buildUnifiedParamsJson(params: Record<string, string>): string {
  const constant: Record<string, string> = {};
  for (const key of CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS) {
    if (params[key] !== undefined) {
      constant[key] = params[key];
    }
  }
  constant.scene = 'unified';
  constant.storageNamespace = 'unified';
  constant.type = 'market';
  constant.symbol = CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL;
  constant.decimal = '2';
  // Off by default; perps order/draft UI is gated app-side (enablePerpsTradingUi
  // prop) and lines are pushed explicitly, so a constant value here keeps the
  // source identical across hosts.
  constant.enablePerpsTradingUi = '0';
  return JSON.stringify(constant);
}

// Market tokens route by source-encoded symbol (the chart carries decimal per
// token); perps route to the Hyperliquid datafeed. Display labels are UI-only.
function buildSymbolChangeMessage(params: Record<string, string>) {
  const source = params.type === 'perps' ? 'hyperliquid' : 'market';
  return {
    type: 'SYMBOL_CHANGE',
    payload: {
      source,
      symbol: params.symbol,
      networkId: params.networkId,
      address: params.address,
      decimal: params.decimal,
      displayPair: params.symbol,
      displayCoin: params.symbol,
      force: true,
    },
  };
}

// Identity of the currently-shown token, so we don't re-post an unchanged symbol.
function unifiedSymbolKey(params: Record<string, string>): string {
  return [
    params.type,
    params.symbol,
    params.address,
    params.networkId,
    params.decimal,
  ]
    .map((part) => part ?? '')
    .join(':');
}

export function ChartWebView({
  params,
  onlineUrl,
  customReceiveHandler,
  onWebViewRef,
  onLoadEnd,
  selfDrivenSymbol,
  ...stackStyle
}: IChartWebViewProps) {
  const hybridRefHolder = useRef<ChartWebviewMethods | null>(null);
  const isFocused = useRouteIsFocused();

  // When the consumer drives its own symbol switching (e.g. perps sends a richer
  // SYMBOL_CHANGE with source/displayNames + ready-gating), the host must NOT
  // also auto-post one — that would double-send and race.
  const autoDriveSymbol = IS_UNIFIED && !selfDrivenSymbol;

  // Latest values for use inside Nitro callbacks (which capture once).
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const autoDriveSymbolRef = useRef(autoDriveSymbol);
  autoDriveSymbolRef.current = autoDriveSymbol;
  const onLoadEndRef = useRef(onLoadEnd);
  onLoadEndRef.current = onLoadEnd;
  // Dedupe SYMBOL_CHANGE; cleared on blur so re-focusing always resyncs (the
  // shared page may have been switched to another token while we were inactive).
  const lastSentKeyRef = useRef<string | null>(null);

  const sendSymbolChange = useCallback(() => {
    const current = paramsRef.current;
    if (!current.symbol) return;
    hybridRefHolder.current?.postMessage(
      JSON.stringify(buildSymbolChangeMessage(current)),
    );
    lastSentKeyRef.current = unifiedSymbolKey(current);
  }, []);

  // Adapter exposing the IWebViewRef surface used by TradingView hooks/handlers
  // (sendMessageViaInjectedScript / reload), backed by the chart-webview
  // module's imperative methods. Lets every existing call site work unchanged.
  const adapterRef = useRef<IWebViewRef | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = {
      sendMessageViaInjectedScript: (message: unknown) => {
        // Module injects window.postMessage(JSON.parse(str)); the legacy script
        // did window.postMessage(message) — equivalent.
        hybridRefHolder.current?.postMessage(JSON.stringify(message));
      },
      reload: () => {
        hybridRefHolder.current?.reload();
      },
      loadURL: () => {
        // no-op: source switching is code-level (remount via key)
      },
    } as unknown as IWebViewRef;
  }

  useEffect(() => {
    onWebViewRef?.(adapterRef.current);
    return () => {
      onWebViewRef?.(null);
    };
  }, [onWebViewRef]);

  // Unified: deliver every symbol switch via SYMBOL_CHANGE (no reload). Send on
  // focus + token change; clear the dedupe key on blur so re-focus resyncs.
  useEffect(() => {
    if (!autoDriveSymbol) return;
    if (!isFocused) {
      lastSentKeyRef.current = null;
      return;
    }
    if (lastSentKeyRef.current === unifiedSymbolKey(params)) return;
    sendSymbolChange();
  }, [autoDriveSymbol, isFocused, params, sendSymbolChange]);

  const source = useMemo(() => {
    if (CHART_WEBVIEW_MODE === 'online') {
      return { uri: onlineUrl };
    }
    if (IS_UNIFIED) {
      // uri:'' so the source keys never flip absent (Nitro rejects that).
      return {
        uri: '',
        localBundle: CHART_WEBVIEW_LOCAL_BUNDLE,
        entry: CHART_WEBVIEW_ENTRY,
        paramsJson: buildUnifiedParamsJson(params),
      };
    }
    return {
      localBundle: CHART_WEBVIEW_LOCAL_BUNDLE,
      entry: CHART_WEBVIEW_ENTRY,
      paramsJson: JSON.stringify(params),
    };
  }, [onlineUrl, params]);

  // Pooling: ONE warm WebView shared across the whole app (market + perps), kept
  // alive across navigation by the native singleton pool. The focused screen
  // owns it; blurred screens yield (showing a snapshot) but never destroy it.
  // Gated to offline — online mode keys its source by URL, which would fight the
  // shared-WebView reuse.
  const reuseKey =
    CHART_WEBVIEW_POOLED && CHART_WEBVIEW_MODE !== 'online'
      ? CHART_WEBVIEW_REUSE_KEY
      : undefined;

  // Nitro requires function props wrapped with callback(). The hybridRef callback
  // hands us a ref whose .current is the live HybridObject (postMessage/reload).
  const hybridRefProp = useMemo(
    () =>
      callback((r: HybridView<ChartWebviewProps, ChartWebviewMethods>) => {
        hybridRefHolder.current = r;
      }),
    [],
  );

  const onMessageProp = useMemo(
    () =>
      callback((raw: string) => {
        try {
          // Module delivers the chart's $private.request payload as a raw JSON
          // string; legacy handlers expect it wrapped as { data: payload }.
          void customReceiveHandler?.({ data: JSON.parse(raw) });
        } catch {
          // ignore malformed messages
        }
      }),
    [customReceiveHandler],
  );

  // The unified page boots on a placeholder symbol; once it (and its
  // SYMBOL_CHANGE listener) is loaded, push the active host's real token. Fires
  // on the owner host, so it always targets the focused screen's symbol.
  const onLoadEndProp = useMemo(
    () =>
      callback(() => {
        if (autoDriveSymbolRef.current && isFocusedRef.current) {
          lastSentKeyRef.current = null;
          sendSymbolChange();
        }
        // Forward to the consumer (perps re-syncs its own symbol + enables lines).
        onLoadEndRef.current?.();
      }),
    [sendSymbolChange],
  );

  // Remount when the source mode/url changes so the new source loads cleanly.
  // Unified keeps a constant key so a token switch never remounts (it reloads via
  // SYMBOL_CHANGE instead).
  const sourceKey =
    CHART_WEBVIEW_MODE === 'online' ? `online:${onlineUrl}` : 'offline';

  return (
    <Stack position="relative" flex={1} {...stackStyle}>
      <ChartWebviewView
        key={sourceKey}
        style={{ flex: 1 }}
        {...source}
        pooled={!!reuseKey}
        reuseKey={reuseKey}
        active={isFocused}
        hybridRef={hybridRefProp}
        onMessage={onMessageProp}
        onLoadEnd={onLoadEndProp}
      />
    </Stack>
  );
}

export default ChartWebView;
