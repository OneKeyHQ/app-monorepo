import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';

import WebView from '../../WebView';

import { buildUnifiedChartUrl } from './unifiedUrl';

import type { IChartWebViewProps } from './types';
import type { IWebViewRef } from '../../WebView/types';

// Market tokens route by source-encoded symbol; perps route to Hyperliquid.
// force:false keeps the message idempotent so re-asserting is a no-op when the
// page already shows the symbol. Mirrors the native host's builder.
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

  const sendSymbolChange = useCallback(() => {
    const ref = webRefHolder.current;
    const current = paramsRef.current;
    if (!ref || !current.symbol) return;
    ref.sendMessageViaInjectedScript(buildSymbolChangeMessage(current));
  }, []);

  // Constant per-domain unified source: token-independent, so token switches
  // never change the URL (no reload). Rebuilds only on app-global changes
  // (theme/locale) via the `key`, which is rare.
  const unifiedUrl = useMemo(() => buildUnifiedChartUrl(params), [params]);

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
