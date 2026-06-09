import { useSyncExternalStore } from 'react';

// Shared "does the chart currently have data" flag, used to drive the loading
// mask. It is GLOBAL (not per-component) on purpose: there is a single shared
// pooled chart WebView showing one symbol, but several React host instances can
// exist at once (the offscreen prewarm + the visible detail, plus stale
// instances during rapid navigation). The unified `tradingview_barsState` signal
// is routed to whichever host owns the WebView at that instant — NOT necessarily
// the visible one — so per-instance state left the visible chart stuck on the
// loading mask. A single shared flag means any owner that learns "has data"
// reveals the chart for everyone.
let ready = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

// Data confirmed present on the shared page -> hide the loading mask. Only ever
// flipped true here (never false), so a stray empty/error bars-state for a
// half-typed search symbol can't hide-then-reshow a working chart.
export function markChartDataReady() {
  if (!ready) {
    ready = true;
    emit();
  }
}

// The (focused) chart is switching symbol -> show the loading mask again until
// the new symbol's bars arrive. Gated by the caller on focus so a background
// prewarm switching symbols never blanks the visible chart.
export function markChartLoading() {
  if (ready) {
    ready = false;
    emit();
  }
}

export function useChartDataReady(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => ready,
    () => ready,
  );
}
