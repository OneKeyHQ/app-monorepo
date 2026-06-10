import { useEffect, useState, useSyncExternalStore } from 'react';

// Safety net for the loading mask. Some chart paths never emit the unified
// `tradingview_barsState` signal at all (the online / legacy remote bundle does
// not carry this newer instrumentation), so `markChartDataReady` would never
// fire and the mask would cover the chart forever. Reveal the chart after this
// many ms even when no bars-state arrived. Kept long enough that a normal kline
// fetch resolves (and clears the mask precisely) well before the fallback.
const CHART_LOADING_MASK_TIMEOUT_MS = 8000;

// Tracks WHICH chart identity the shared chart currently has data for, so the
// loading mask can be derived as `readyKey !== currentKey`. This is GLOBAL (not
// per-component): a single shared pooled chart WebView shows one chart at a time,
// but several React host instances exist at once (offscreen prewarm + visible
// detail + stale instances during navigation), and the unified
// `tradingview_barsState` signal is routed to whichever host owns the WebView —
// not necessarily the visible one. Keying by a STABLE IDENTITY (not a plain
// boolean, and not the bare symbol) means:
//   - re-entering an already-loaded chart shows NO loading (no fresh barsState
//     fires for a cached page — the old boolean + reset-on-mount got stuck here);
//   - switching to a new chart shows loading until ITS bars arrive, with no
//     explicit reset call needed (mismatch == loading).
// The key MUST include surface + network + address, not just the symbol: the same
// ticker exists across chains (ETH on multiple networks) and across surfaces
// (market vs perps). Keying by bare symbol would let one `ETH` mark another `ETH`
// ready and hide its mask while the wrong/stale chart is still showing.
let readyKey: string | null = null;
const listeners = new Set<() => void>();

// Stable identity for a market chart: a given token is uniquely a (network,
// address, symbol) triple. Used by BOTH the visible detail host and the offscreen
// prewarm host so prewarm's bars-state clears the detail mask — keep the inputs
// identical on both sides.
export function getMarketChartReadyKey(params: {
  networkId?: string;
  tokenAddress?: string;
  symbol: string | undefined;
}): string | undefined {
  if (!params.symbol) {
    return undefined;
  }
  return `market:${params.networkId ?? ''}:${params.tokenAddress ?? ''}:${
    params.symbol
  }`;
}

// Stable identity for a perps chart. Perps symbols are already globally unique
// within the perps surface, so the symbol alone (namespaced by `perps:`) suffices.
export function getPerpsChartReadyKey(
  symbol: string | undefined,
): string | undefined {
  if (!symbol) {
    return undefined;
  }
  return `perps:${symbol}`;
}

function emit() {
  listeners.forEach((l) => l());
}

// The chart engine resolved getBars for `key`'s chart on the shared page — data
// is present OR the chart is confirmed empty. Either way loading is done, so this
// clears the mask. Called from any host's onBarsState (detail or prewarm) with
// that host's current chart key. NOTE: an empty token is "loaded, empty", NOT
// "still loading"; treating it as ready prevents a permanent mask on tokens that
// genuinely have no kline data.
export function markChartDataReady(key: string | undefined) {
  if (!key || readyKey === key) {
    return;
  }
  readyKey = key;
  emit();
}

// True when the shared chart currently has data for `key`. Drives the mask: show
// the loading mask while this is false.
export function useChartHasData(key: string | undefined): boolean {
  const ready = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => readyKey,
    () => readyKey,
  );
  const hasData = !!key && ready === key;

  // Fallback reveal: if no bars-state ever arrives for this key (a bundle that
  // doesn't emit the signal, or a hung load), drop the mask after a timeout so
  // the chart is never permanently hidden. Resets whenever the key changes or
  // real data arrives first.
  const [revealedByTimeout, setRevealedByTimeout] = useState(false);
  useEffect(() => {
    setRevealedByTimeout(false);
    if (!key || hasData) {
      return;
    }
    const timer = setTimeout(
      () => setRevealedByTimeout(true),
      CHART_LOADING_MASK_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [key, hasData]);

  return hasData || revealedByTimeout;
}
