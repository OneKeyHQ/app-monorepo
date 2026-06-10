import { useEffect, useState, useSyncExternalStore } from 'react';

// Safety net for the loading mask. Some chart paths never emit the unified
// `tradingview_barsState` signal at all (the online / legacy remote bundle does
// not carry this newer instrumentation), so `markChartDataReady` would never
// fire and the mask would cover the chart forever. Reveal the chart after this
// many ms even when no bars-state arrived. Kept long enough that a normal kline
// fetch resolves (and clears the mask precisely) well before the fallback.
const CHART_LOADING_MASK_TIMEOUT_MS = 8000;

// Tracks WHICH symbol the shared chart currently has data for, so the loading
// mask can be derived as `readySymbol !== currentSymbol`. This is GLOBAL (not
// per-component): a single shared pooled chart WebView shows one symbol, but
// several React host instances exist at once (offscreen prewarm + visible detail
// + stale instances during navigation), and the unified `tradingview_barsState`
// signal is routed to whichever host owns the WebView — not necessarily the
// visible one. Keying by symbol (instead of a plain boolean) means:
//   - re-entering an already-loaded symbol shows NO loading (no fresh barsState
//     fires for a cached page — the old boolean + reset-on-mount got stuck here);
//   - switching to a new symbol shows loading until ITS bars arrive, with no
//     explicit reset call needed (mismatch == loading).
let readySymbol: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

// The chart engine resolved getBars for `symbol` on the shared page — data is
// present OR the symbol is confirmed empty. Either way loading is done, so this
// clears the mask. Called from any host's onBarsState (detail or prewarm) with
// that host's current symbol. NOTE: an empty token is "loaded, empty", NOT
// "still loading"; treating it as ready prevents a permanent mask on tokens that
// genuinely have no kline data.
export function markChartDataReady(symbol: string) {
  if (!symbol || readySymbol === symbol) {
    return;
  }
  readySymbol = symbol;
  emit();
}

// True when the shared chart currently has data for `symbol`. Drives the mask:
// show the loading mask while this is false.
export function useChartHasData(symbol: string | undefined): boolean {
  const ready = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => readySymbol,
    () => readySymbol,
  );
  const hasData = !!symbol && ready === symbol;

  // Fallback reveal: if no bars-state ever arrives for this symbol (a bundle that
  // doesn't emit the signal, or a hung load), drop the mask after a timeout so
  // the chart is never permanently hidden. Resets whenever the symbol changes or
  // real data arrives first.
  const [revealedByTimeout, setRevealedByTimeout] = useState(false);
  useEffect(() => {
    setRevealedByTimeout(false);
    if (!symbol || hasData) {
      return;
    }
    const timer = setTimeout(
      () => setRevealedByTimeout(true),
      CHART_LOADING_MASK_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [symbol, hasData]);

  return hasData || revealedByTimeout;
}
