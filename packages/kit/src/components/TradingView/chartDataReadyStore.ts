import { useSyncExternalStore } from 'react';

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

// Bars confirmed present for `symbol` on the shared page. Called from any host's
// onBarsState (detail or prewarm) with that host's current symbol.
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
  return hasData;
}
