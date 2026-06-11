import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../../WebView';

import { buildSymbolChangeMessage } from './buildSymbolChangeMessage';
import { buildUnifiedChartUrl } from './unifiedUrl';

import type { IChartWebViewProps } from './types';
import type { IWebViewRef } from '../../WebView/types';

/**
 * Desktop chart host (in-flow).
 *
 * Renders a normal kit <WebView> directly in the page flow — so it scrolls
 * natively with its container (no absolute positioning, no jitter). The source
 * is a CONSTANT per-domain unified URL, so switching tokens never changes the
 * URL and the page never reloads; the active token rides SYMBOL_CHANGE instead
 * (the desktop equivalent of native's warm unified chart). market and perps each
 * mount their own instance, so they stay isolated.
 *
 * `onlineUrl` is ignored here (offline-only path); the consumer's webRef hooks
 * (kline/marks/perps lines) drive the real <WebView> ref directly.
 */
export function ChartWebView({
  params,
  customReceiveHandler,
  onWebViewRef,
  onLoadEnd,
  selfDrivenSymbol,
  ...stackStyle
}: IChartWebViewProps) {
  const isFocused = useRouteIsFocused();

  // When the consumer drives its own SYMBOL_CHANGE (richer payload + gating), the
  // host must NOT also auto-post one — that would double-send and race.
  const autoDriveSymbol = !selfDrivenSymbol;

  const webRefHolder = useRef<IWebViewRef | null>(null);
  const [ready, setReady] = useState(false);

  // Latest values for use inside the (mount-stable) ref callback / effects.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const autoDriveSymbolRef = useRef(autoDriveSymbol);
  autoDriveSymbolRef.current = autoDriveSymbol;
  const onLoadEndRef = useRef(onLoadEnd);
  onLoadEndRef.current = onLoadEnd;
  // Eager send fires once per mount so a backgrounded host doesn't keep posting.
  const didEagerSendRef = useRef(false);

  // Self-heal for the unified boot placeholder (mirrors index.native.tsx).
  // The page boots on the constant placeholder symbol (HL:BTC) and the real
  // token rides a force:false SYMBOL_CHANGE. The first force:false occasionally
  // does nothing (known chart-bundle bug) — without a retry the chart stays stuck
  // on the placeholder (e.g. a market ETH host showing BTC). switchAckedRef flips
  // true when the page starts fetching/rendering for our symbol; if it hasn't
  // within 3s we re-send ONCE with force:true. One-shot per drive so a token that
  // never acknowledges (empty data) can't loop. Remove once the chart bundle is
  // fixed.
  const switchAckedRef = useRef(false);
  const resentRef = useRef(false);
  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendSymbolChange = useCallback(() => {
    const ref = webRefHolder.current;
    const current = paramsRef.current;
    if (!ref || !current.symbol) return;
    ref.sendMessageViaInjectedScript(buildSymbolChangeMessage(current));
    // Arm the 3s self-heal (see note above).
    const drivenSymbol = current.symbol;
    switchAckedRef.current = false;
    resentRef.current = false;
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
    resendTimerRef.current = setTimeout(() => {
      if (switchAckedRef.current || resentRef.current) return;
      const r = webRefHolder.current;
      const c = paramsRef.current;
      if (!r || c.symbol !== drivenSymbol) return; // symbol moved on / gone
      resentRef.current = true;
      const forced = buildSymbolChangeMessage(c);
      (forced.payload as { force: boolean }).force = true;
      r.sendMessageViaInjectedScript(forced);
    }, 3000);
  }, []);

  // Cancel a pending self-heal when this host unmounts.
  useEffect(
    () => () => {
      if (resendTimerRef.current) clearTimeout(resendTimerRef.current);
    },
    [],
  );

  // Constant per-domain unified source: token-independent, so token switches
  // never change the URL (no reload). Rebuilds only on app-global changes
  // (theme/locale) via the `key`, which is rare.
  const unifiedUrl = useMemo(() => buildUnifiedChartUrl(params), [params]);

  // Diagnostic: this desktop host is the OFFLINE path — it only mounts when the
  // asar shipped the bundle (getDesktopOfflineChartReady), serving the constant
  // onekey-chart:// source. The online fallback (bundle absent → legacy WebView)
  // is logged in useTradingViewUrl instead (this component never renders there).
  useEffect(() => {
    defaultLogger.market.chart.chartSource({
      platform: platformEnv.appPlatform ?? 'desktop',
      type: paramsRef.current.type,
      mode: 'offline',
      sourceKind: 'offline',
    });
  }, []);

  const handleInnerRef = useCallback(
    (ref: IWebViewRef | null) => {
      webRefHolder.current = ref;
      onWebViewRef?.(ref);
      setReady(!!ref);
    },
    [onWebViewRef],
  );

  // (1) Eager: push our symbol the moment the transport is ready, so the chart
  // switches during the navigation transition instead of showing the placeholder
  // for a beat. Fires once per mount.
  useEffect(() => {
    if (!autoDriveSymbol || !ready || didEagerSendRef.current) return;
    didEagerSendRef.current = true;
    sendSymbolChange();
  }, [autoDriveSymbol, ready, sendSymbolChange]);

  // (2) Focused resync: re-assert our symbol whenever we hold focus or it changes
  // while focused. Idempotent (force:false), so a no-op when already shown.
  useEffect(() => {
    if (!autoDriveSymbol || !ready || !isFocused) return;
    sendSymbolChange();
  }, [autoDriveSymbol, ready, isFocused, params, sendSymbolChange]);

  // The page boots on a placeholder symbol; once its SYMBOL_CHANGE listener is
  // up (load end), push the active token and forward to the consumer.
  const handleLoadEnd = useCallback(() => {
    defaultLogger.market.chart.chartLoadEnd({
      platform: platformEnv.appPlatform ?? 'desktop',
      type: paramsRef.current.type,
      sourceKind: 'offline',
    });
    if (autoDriveSymbolRef.current && isFocusedRef.current) {
      sendSymbolChange();
    }
    onLoadEndRef.current?.();
  }, [sendSymbolChange]);

  return (
    <Stack position="relative" flex={1} {...stackStyle}>
      <WebView
        // Re-key only on app-global changes (theme/locale); token switches keep
        // the same URL so the page never reloads.
        key={`chart:${unifiedUrl}`}
        src={unifiedUrl}
        customReceiveHandler={async (data) => {
          // ACK for the self-heal retry: any of these messages means the page is
          // actively fetching/rendering for the CURRENT symbol, i.e. the
          // SYMBOL_CHANGE took — so cancel the pending 3s force-resend. Mirrors
          // index.native.tsx's ack list.
          try {
            const raw = typeof data === 'string' ? data : JSON.stringify(data);
            if (
              raw.includes('tradingview_barsState') ||
              raw.includes('tradingview_renderReady') ||
              raw.includes('tradingview_getKLineData')
            ) {
              switchAckedRef.current = true;
            }
          } catch {
            // ignore stringify failures
          }
          await customReceiveHandler?.(data as never);
        }}
        onWebViewRef={handleInnerRef}
        onLoadEnd={handleLoadEnd}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        scrollEnabled={false}
      />
    </Stack>
  );
}

export default ChartWebView;
