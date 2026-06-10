import { useEffect, useRef, useSyncExternalStore } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// TEMP diagnostic (root-cause C3 verification): low-frequency, change-only logs.
// markReady fires only when readySymbol actually changes; maskEval only when a
// host's (symbol, ready, hasData) tuple changes — never per render/message — so
// this can't flood. Shows symbol thrashing + how many subscribers re-render.
function dbgReady(payload: Record<string, unknown>) {
  defaultLogger.market.chart.chartHost({
    platform: platformEnv.appPlatform ?? 'native',
    type: 'store',
    ...payload,
  } as any);
}

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
  // C3: readySymbol churn + how many subscribers will re-render via emit().
  dbgReady({
    event: 'markReady',
    symbol,
    prev: readySymbol ?? '(null)',
    subscribers: listeners.size,
  });
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
  // C3: change-only mask state (via useEffect, never during render).
  const idRef = useRef(0);
  if (idRef.current === 0) {
    hookSeq += 1;
    idRef.current = hookSeq;
  }
  useEffect(() => {
    dbgReady({
      event: 'maskEval',
      inst: idRef.current,
      symbol: symbol ?? '(undef)',
      readySymbol: ready ?? '(null)',
      hasData,
    });
  }, [symbol, ready, hasData]);
  return hasData;
}

let hookSeq = 0;
