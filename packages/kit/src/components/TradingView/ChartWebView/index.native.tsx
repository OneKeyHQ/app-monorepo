import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ChartWebviewMethods,
  type ChartWebviewProps,
  ChartWebviewView,
} from '@onekeyfe/react-native-chart-webview';
import { type HybridView, callback } from 'react-native-nitro-modules';

import { Stack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  // INTENTIONAL SHARED NAMESPACE (single-pool tradeoff). storageNamespace is a
  // boot param baked into the source, and the byte-identical-source invariant
  // above requires it to be constant across market and perps hosts (any per-domain
  // value would make the two sources differ → the shared pooled WebView would
  // reload on every market<->perps switch, defeating the warm single-WebView
  // design). So on native, market and perps deliberately SHARE the same
  // `tradingview_settings_*` / `tradingview_study_template_*` storage. (Desktop
  // can afford per-domain isolation — see unifiedUrl.ts — because it mounts two
  // separate in-flow WebViews with distinct URLs, not one shared pool.) True
  // per-domain isolation under the shared pool would have to live inside the chart
  // repo, keyed off the active SYMBOL_CHANGE source ('market' vs 'hyperliquid')
  // rather than this boot-time namespace; the app-side SYMBOL_CHANGE payload
  // carries no storageNamespace, so it cannot be done here without regressing the
  // no-reload reuse.
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
// force:false makes the message idempotent — the chart no-ops when it already
// shows this symbol (so we can send eagerly/often without flicker) and switches
// when it doesn't. We never need to force a re-render of the same symbol here.
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
      force: false,
    },
  };
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
  // Eager send happens once per mount (the incoming screen), so a background host
  // doesn't keep re-posting; the focus effect re-asserts afterwards.
  const didEagerSendRef = useRef(false);
  // The Nitro hybridRef arrives AFTER the first render/effect, so a send can fire
  // before postMessage is wired. Gate sends on this and re-run when it flips true.
  const [hybridReady, setHybridReady] = useState(false);

  const sendSymbolChange = useCallback(() => {
    const ref = hybridRefHolder.current;
    const current = paramsRef.current;
    if (!ref || !current.symbol) return;
    ref.postMessage(JSON.stringify(buildSymbolChangeMessage(current)));
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

  // (1) Eager: push our symbol the moment the transport is ready — BEFORE this
  // screen finishes focusing — so the chart switches during the navigation
  // transition and the new screen appears already showing the right symbol
  // (instead of the previous one for a beat). Fires once per mount = only the
  // incoming screen, so background hosts don't hijack the shared page.
  useEffect(() => {
    if (!autoDriveSymbol || !hybridReady || didEagerSendRef.current) return;
    didEagerSendRef.current = true;
    sendSymbolChange();
  }, [autoDriveSymbol, hybridReady, sendSymbolChange]);

  // (2) Focused resync: re-assert our symbol whenever we hold focus or our symbol
  // changes while focused — the shared page may have been moved by another host.
  // Idempotent (force:false), so a no-op when the page already shows our symbol.
  useEffect(() => {
    if (!autoDriveSymbol || !hybridReady || !isFocused) return;
    sendSymbolChange();
  }, [autoDriveSymbol, hybridReady, isFocused, params, sendSymbolChange]);

  const source = useMemo(() => {
    if (CHART_WEBVIEW_MODE === 'online') {
      return { uri: onlineUrl };
    }
    // Offline asset-presence fallback (white-screen guard).
    //
    // The offline bundle (assets/tradingview-assets) is fetched + copied into the
    // app ONLY by release/internal builds that run fetch-tradingview-assets.mjs
    // with a read token. Open-source / no-token builds (and any build that skipped
    // the fetch) ship NO assets, so loading the localBundle would resolve to a
    // missing index.html and render "Not Found" (white chart) with no recovery.
    //
    // There is no JS-visible readiness signal on native: the chart-webview module
    // exposes no asset-presence / constants API (unlike desktop's
    // `tradingViewOfflineReady` global, see ready.ts), the asset staging is a pure
    // native-bundle filesystem step (iOS Run Script / Android Gradle copy) with no
    // runtime flag surfaced to JS, and CHART_WEBVIEW_LOCAL_BUNDLE is a hardcoded
    // folder name that stays constant whether or not the files were actually
    // staged. So JS cannot reliably gate on bundle presence here.
    //
    // CONTRACT WITH NATIVE: we therefore pass the online URL as an explicit
    // `fallbackUri` alongside the localBundle. The native module MUST load
    // `fallbackUri` when the localBundle's `entry` asset is absent on disk (i.e.
    // when it would otherwise serve a "Not Found" page), and use the localBundle
    // when present. NOTE/LIMITATION: today's native computeTargetUrl (iOS/Android)
    // does NOT yet honor `fallbackUri` — a non-empty `uri` simply wins outright and
    // an empty `uri` falls through to the localBundle regardless of whether its
    // files exist. So this guard only takes effect once the native module is
    // updated to read `fallbackUri`; until then asset-less builds still need the
    // release pipeline to either stage assets or flip CHART_WEBVIEW_MODE to
    // 'online'. `fallbackUri` is app-global (the same remote chart URL), so it does
    // NOT taint the byte-identical unified source: localBundle/entry/paramsJson —
    // the keys that drive the shared WebView's load + reuse — stay identical across
    // market and perps hosts. Only emitted when an online URL actually exists.
    const fallbackUri = onlineUrl ? { fallbackUri: onlineUrl } : {};
    if (IS_UNIFIED) {
      // uri:'' so the source keys never flip absent (Nitro rejects that).
      return {
        uri: '',
        ...fallbackUri,
        localBundle: CHART_WEBVIEW_LOCAL_BUNDLE,
        entry: CHART_WEBVIEW_ENTRY,
        paramsJson: buildUnifiedParamsJson(params),
      };
    }
    return {
      ...fallbackUri,
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

  // Diagnostic: confirm whether this native chart resolves to the offline
  // app-bundled assets or the remote online URL (see market.chart scene). Logs
  // intent only — JS has no asset-presence signal on native, so 'offline' here
  // means CHART_WEBVIEW_MODE selected the localBundle, not that the files exist.
  const sourceKind = CHART_WEBVIEW_MODE === 'online' ? 'online' : 'offline';
  useEffect(() => {
    defaultLogger.market.chart.chartSource({
      platform: platformEnv.appPlatform ?? 'native',
      type: paramsRef.current.type,
      mode: CHART_WEBVIEW_MODE,
      sourceKind,
      scene: CHART_WEBVIEW_SCENE,
      pooled: !!reuseKey,
      hasOnlineFallback: !!onlineUrl,
    });
  }, [sourceKind, reuseKey, onlineUrl]);

  // Nitro requires function props wrapped with callback(). The hybridRef callback
  // hands us a ref whose .current is the live HybridObject (postMessage/reload).
  const hybridRefProp = useMemo(
    () =>
      callback((r: HybridView<ChartWebviewProps, ChartWebviewMethods>) => {
        hybridRefHolder.current = r;
        // Flip ready so the auto-drive effect re-runs now that postMessage works.
        setHybridReady(true);
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
        defaultLogger.market.chart.chartLoadEnd({
          platform: platformEnv.appPlatform ?? 'native',
          type: paramsRef.current.type,
          sourceKind,
        });
        // Cold first load: the page's SYMBOL_CHANGE listener wasn't up for the
        // eager send, so re-assert now that it is.
        if (autoDriveSymbolRef.current && isFocusedRef.current) {
          sendSymbolChange();
        }
        // Forward to the consumer (perps re-syncs its own symbol + enables lines).
        onLoadEndRef.current?.();
      }),
    [sendSymbolChange, sourceKind],
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
