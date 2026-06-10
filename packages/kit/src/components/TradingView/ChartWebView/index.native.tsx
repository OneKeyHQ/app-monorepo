import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ChartWebviewMethods,
  type ChartWebviewProps,
  ChartWebviewView,
} from '@onekeyfe/react-native-chart-webview';
import { type HybridView, callback } from 'react-native-nitro-modules';

import { Stack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  CHART_WEBVIEW_ENTRY,
  CHART_WEBVIEW_LOCAL_BUNDLE,
  CHART_WEBVIEW_POOLED,
  CHART_WEBVIEW_REUSE_KEY,
  CHART_WEBVIEW_SCENE,
  CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS,
  CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL,
  getChartWebViewMode,
} from './constants';

import type { IChartWebViewProps } from './types';
import type { IWebViewRef } from '../../WebView/types';

// Unified scene only applies to the native offline/local bundle (online keys its
// source by URL, which fights the constant-source reuse). The mode comes from
// the cold-start snapshot resolver, so this is computed per render (the snapshot
// is locked for the session, so the value is stable) rather than at import.
function isUnifiedMode(): boolean {
  return (
    getChartWebViewMode() !== 'online' && CHART_WEBVIEW_SCENE === 'unified'
  );
}

// Android-only `assetHost` (Part G): the offline bundle mounts the OLD chart
// origin so the legacy `tradingview_*_market_*` keys (written by the previous
// remote chart) are read directly from the same-process WebView storage — i.e.
// zero migration. The host is derived from the same prod/test URLs the online
// chart uses, picked by platformEnv.isProduction. iOS/desktop never set this
// (the module ignores it on iOS; falls back to appassets.androidplatform.net).
const ANDROID_ASSET_HOST: string | undefined = platformEnv.isNativeAndroid
  ? new URL(platformEnv.isProduction ? TRADING_VIEW_URL : TRADING_VIEW_URL_TEST)
      .host
  : undefined;

let hasUnifiedChartLoadEnded = false;

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
  //
  // VALUE = 'market' (not 'unified'): the native single pool means market+perps
  // share ONE bucket; we point it at the LEGACY 'market' namespace so that, when
  // the Android offline bundle mounts the old origin (Part G assetHost), the
  // pre-existing `tradingview_*_market_*` keys are read directly — zero migration.
  constant.storageNamespace = 'market';
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
  prewarm,
  ...stackStyle
}: IChartWebViewProps) {
  const hybridRefHolder = useRef<ChartWebviewMethods | null>(null);
  const isFocusedRaw = useRouteIsFocused();
  // A prewarm host NEVER claims native ownership: it warm-loads + drives the
  // symbol + prefetches data via the warmDriver path, but `active=false` so the
  // native pauseIfIdle can pause the offscreen renderer (Android doesn't throttle
  // offscreen WebViews). `isFocused` keeps the prewarm's symbol-driving effects
  // running while its home is focused; only OWNERSHIP is suppressed.
  const isFocused = isFocusedRaw;
  // Prewarm is iOS-only now (see ChartPrewarm.enabled); keep ownership == focus
  // for every host (the prior Android-specific `active=false` prewarm tweak is
  // moot now that Android has no prewarm host).
  //
  // EXCEPTION: a prewarm host (also used by the hidden migration RestoreHost,
  // which lives OUTSIDE any navigator screen so `useRouteIsFocused()` returns
  // true) must NEVER claim native pool ownership — otherwise the offscreen
  // restore host would evict the user's visible chart from the shared
  // `onekey-chart-singleton` pool. Force `active=false` whenever `prewarm` is set
  // so such a host stays offscreen and owns nothing.
  const active = isFocused && !prewarm;
  // Effective chart mode resolved from the cold-start snapshot (Part B2). The
  // snapshot is locked for the session, so these are stable across renders; we
  // still thread them through memo deps so the rule of hooks is satisfied.
  const mode = getChartWebViewMode();
  const isUnified = isUnifiedMode();
  // Honor the app's "Enable Native Webview Debugging" dev-mode toggle for the
  // chart webview, exactly like the main react-native-webview (NativeWebView.tsx).
  // Fallback mirrors that component: default to platformEnv.isDev when unset.
  const [devSettings] = useDevSettingsPersistAtom();
  const webviewDebuggingEnabled =
    devSettings.settings?.webviewDebuggingEnabled ?? platformEnv.isDev;

  // When the consumer drives its own symbol switching (e.g. perps sends a richer
  // SYMBOL_CHANGE with source/displayNames + ready-gating), the host must NOT
  // also auto-post one — that would double-send and race.
  const autoDriveSymbol = isUnified && !selfDrivenSymbol;

  // Latest values for use inside Nitro callbacks (which capture once).
  const paramsRef = useRef(params);
  paramsRef.current = params;
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

  // ⚠️ FALLBACK / 兜底方案 — NOT a root-cause fix.
  // Symptom: on Android, the first force:false SYMBOL_CHANGE intermittently does
  // NOT take — the shared page stays on the PREVIOUS token (no getKLineData /
  // barsState for the new symbol) and the chart hangs on the loading mask. CDP
  // confirmed the page is still drawing the old symbol while the new token's data
  // streams in. The real bug lives in the offline chart bundle's SYMBOL_CHANGE
  // handler (it drops/ignores the switch under a rapid-switch race); fixing it
  // there is the proper solution. Until then this is a DEFENSIVE retry: after a
  // drive, if the page hasn't acknowledged the switch within 3s, re-send ONCE with
  // force:true. One-shot per drive so an empty-data token (never emits barsState)
  // can't cause an endless resend loop. Remove once the chart bundle is fixed.
  const switchAckedRef = useRef(false);
  const resentRef = useRef(false);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendSymbolChange = useCallback(() => {
    const ref = hybridRefHolder.current;
    const current = paramsRef.current;
    if (!ref || !current.symbol) return;
    ref.postMessage(JSON.stringify(buildSymbolChangeMessage(current)));
    // Arm the 3s self-heal (see FALLBACK note above).
    const drivenSymbol = current.symbol;
    switchAckedRef.current = false;
    resentRef.current = false;
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
    resendTimerRef.current = setTimeout(() => {
      if (switchAckedRef.current || resentRef.current) return;
      const r = hybridRefHolder.current;
      const c = paramsRef.current;
      if (!r || c.symbol !== drivenSymbol) return; // symbol moved on / gone
      resentRef.current = true;
      const forced = buildSymbolChangeMessage(c);
      (forced.payload as { force: boolean }).force = true;
      r.postMessage(JSON.stringify(forced));
    }, 3000);
  }, []);

  // Stable VALUE key for the symbol-change payload. `params` is a fresh object
  // every render, so effects that depend on it (the focused resync) used to fire
  // on EVERY re-render — flooding the bridge with SYMBOL_CHANGE and churning the
  // page (the chart re-applied its symbol ~per frame). Depending on this string
  // instead means the resync only runs when the symbol payload actually changes
  // (or focus flips), not on unrelated parent re-renders (price/orderbook ticks).
  const symbolChangeKey = useMemo(
    () =>
      params.symbol ? JSON.stringify(buildSymbolChangeMessage(params)) : '',
    [params],
  );

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

  useEffect(() => {
    return () => {
      // Clear the FALLBACK self-heal timer (see sendSymbolChange) on teardown.
      if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // From origin/x: if the unified chart already finished its (one-time) load,
  // fire onLoadEnd immediately for this host so consumers don't wait again.
  //
  // GUARDED ON hybridReady (Fix #3): `hasUnifiedChartLoadEnded` is module-level
  // and survives a `sourceKey` remount (mode toggle) or a native pool
  // recreation. A stale `true` left over from a previous page could otherwise
  // make a freshly-mounted host fire onLoadEnd BEFORE its page is actually ready.
  // By gating on `hybridReady` (the native transport callback, which only fires
  // once THIS host's WebView is live), a stale flag can never short-circuit a
  // brand-new pool: when the native pool was genuinely recreated, the real
  // onLoadEnd re-stamps the flag; when the shared pool is still warm, hybridReady
  // arrives with the flag correctly reflecting the already-loaded page.
  useEffect(() => {
    if (isUnified && hybridReady && hasUnifiedChartLoadEnded) {
      onLoadEndRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hybridReady]);

  // (1) Eager: push our symbol the moment the transport is ready — BEFORE this
  // screen finishes focusing — so the chart switches during the navigation
  // transition and the new screen appears already showing the right symbol
  // (instead of the previous one for a beat). Fires once per mount = only the
  // incoming screen, so background hosts don't hijack the shared page.
  useEffect(() => {
    if (!autoDriveSymbol || !hybridReady || didEagerSendRef.current) return;
    didEagerSendRef.current = true;
    sendSymbolChange();
  }, [autoDriveSymbol, hybridReady, isFocused, sendSymbolChange]);

  // (2) Focused resync: re-assert our symbol whenever we hold focus or our symbol
  // changes while focused — the shared page may have been moved by another host.
  // Idempotent (force:false), so a no-op when the page already shows our symbol.
  useEffect(() => {
    if (!autoDriveSymbol || !hybridReady || !isFocused) return;
    sendSymbolChange();
    // symbolChangeKey (stable value) instead of `params` (new object每render) so
    // this only re-asserts on focus or an actual symbol change, not every render.
  }, [
    autoDriveSymbol,
    hybridReady,
    isFocused,
    symbolChangeKey,
    sendSymbolChange,
  ]);

  const source = useMemo(() => {
    if (mode === 'online') {
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
    // release pipeline to either stage assets or resolve the mode to 'online'.
    // `fallbackUri` is app-global (the same remote chart URL), so it does
    // NOT taint the byte-identical unified source: localBundle/entry/paramsJson —
    // the keys that drive the shared WebView's load + reuse — stay identical across
    // market and perps hosts. Only emitted when an online URL actually exists.
    const fallbackUri = onlineUrl ? { fallbackUri: onlineUrl } : {};
    if (isUnified) {
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
  }, [onlineUrl, params, mode, isUnified]);

  // Pooling: ONE warm WebView shared across the whole app (market + perps), kept
  // alive across navigation by the native singleton pool. The focused screen
  // owns it; blurred screens yield (showing a snapshot) but never destroy it.
  // Gated to offline — online mode keys its source by URL, which would fight the
  // shared-WebView reuse.
  const reuseKey =
    CHART_WEBVIEW_POOLED && mode !== 'online'
      ? CHART_WEBVIEW_REUSE_KEY
      : undefined;

  // Diagnostic: confirm whether this native chart resolves to the offline
  // app-bundled assets or the remote online URL (see market.chart scene). Logs
  // intent only — JS has no asset-presence signal on native, so 'offline' here
  // means the resolved mode selected the localBundle, not that the files exist.
  const sourceKind = mode === 'online' ? 'online' : 'offline';
  useEffect(() => {
    defaultLogger.market.chart.chartSource({
      platform: platformEnv.appPlatform ?? 'native',
      type: paramsRef.current.type,
      mode,
      sourceKind,
      scene: CHART_WEBVIEW_SCENE,
      pooled: !!reuseKey,
      hasOnlineFallback: !!onlineUrl,
      // Android-only legacy origin (Part G); iOS/desktop leave it undefined.
      assetHost: ANDROID_ASSET_HOST,
    });
  }, [mode, sourceKind, reuseKey, onlineUrl]);

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
          // FALLBACK ack (see sendSymbolChange): any of these messages means the
          // page is actively fetching/rendering for the CURRENT symbol, i.e. the
          // SYMBOL_CHANGE took — so cancel the pending 3s force-resend.
          if (
            raw.includes('tradingview_barsState') ||
            raw.includes('tradingview_renderReady') ||
            raw.includes('tradingview_getKLineData')
          ) {
            switchAckedRef.current = true;
          }
          // Module delivers the chart's $private.request payload as a raw JSON
          // string; legacy handlers expect it wrapped as { data: payload }.
          // A host with no customReceiveHandler (e.g. the prewarm host) drops the
          // page's $private data request here.
          if (!customReceiveHandler) {
            return;
          }
          void customReceiveHandler({ data: JSON.parse(raw) });
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
        if (isUnified) {
          hasUnifiedChartLoadEnded = true;
        }
        // Cold first load: the page's SYMBOL_CHANGE listener wasn't up for the
        // eager send, so re-assert now that it is.
        // Q1 FIX (data): drive the symbol on load even when NOT focused. This
        // callback only runs on the host that owns the page at load time (incl.
        // the provisional warm owner). The page just finished loading and is blank
        // — it MUST be told a symbol now, or it sits idle until a focused host
        // claims (the observed ~5s no-data gap). Dropping the isFocused gate here
        // is safe: a real focused host re-asserts its own symbol on focus (same
        // symbol -> idempotent), and only the load-time owner reaches this point.
        if (autoDriveSymbolRef.current) {
          sendSymbolChange();
        }
        // Forward to the consumer (perps re-syncs its own symbol + enables lines).
        onLoadEndRef.current?.();
      }),
    [sendSymbolChange, sourceKind, isUnified],
  );

  // DEBUG instrumentation: surface native WKWebView load failures (didFail /
  // didFailProvisional). This was previously unwired on the JS side, so a failed
  // offline load produced NO log at all — the only hint was a missing
  // chartLoadEnd. Now it is explicit (Q1/Q2).
  const onErrorProp = useMemo(
    () =>
      callback((message: string) => {
        defaultLogger.market.chart.chartError({
          platform: platformEnv.appPlatform ?? 'native',
          type: paramsRef.current.type,
          sourceKind,
          message,
        });
      }),
    [sourceKind],
  );

  // Remount when the source mode/url changes so the new source loads cleanly.
  // Unified keeps a constant key so a token switch never remounts (it reloads via
  // SYMBOL_CHANGE instead).
  const sourceKey = mode === 'online' ? `online:${onlineUrl}` : 'offline';

  return (
    <Stack position="relative" flex={1} {...stackStyle}>
      <ChartWebviewView
        key={sourceKey}
        style={{ flex: 1 }}
        {...source}
        assetHost={ANDROID_ASSET_HOST}
        pooled={!!reuseKey}
        reuseKey={reuseKey}
        active={active}
        webviewDebuggingEnabled={webviewDebuggingEnabled}
        hybridRef={hybridRefProp}
        onMessage={onMessageProp}
        onLoadEnd={onLoadEndProp}
        onError={onErrorProp}
      />
    </Stack>
  );
}

export default ChartWebView;
