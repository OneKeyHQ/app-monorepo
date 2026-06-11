import { useSyncExternalStore } from 'react';

// Focus-recency ownership for the shared singleton WebView pool (native).
//
// The native pool (ChartWebview.swift) has NO ownership arbitration: the owner is
// simply the last host that reconciled with `active != false`. When a chart screen
// and a chart MODAL overlay are mounted at once, BOTH stay route-focused (a modal
// route does not blur the screen behind it, especially across navigators), so both
// report active=true and fight over the one shared WebView — the background screen
// keeps re-reconciling and stealing it back, and the modal renders blank even
// though its chart loaded.
//
// Model: ownership follows FOCUS RECENCY / stacking order — whoever became focused
// most recently (i.e. the topmost layer) owns the single WebView. Each host, on the
// transition INTO focus, takes the next monotonic sequence number; the owner is the
// focused host holding the highest sequence. This is depth-agnostic by construction:
// screen (seq 1) < modal over it (seq 2) < modal over that (seq 3) … the topmost
// always wins, with no per-call magic number. The critical property: a mere
// re-render does NOT refresh a host's sequence (the acquire runs only on the
// focus transition, gated by effect deps), so the background host can't steal the
// WebView back while a higher layer is open — which is exactly the thrash that left
// the modal blank. On unmount/blur the host releases its slot and the next-highest
// focused host (e.g. the screen underneath) reclaims ownership. JS-only.

const focusSeq = new Map<number, number>();
const listeners = new Set<() => void>();
let seqCounter = 0;
let ownerHostId: number | null = null;

function recomputeOwner() {
  let bestId: number | null = null;
  let bestSeq = -1;
  for (const [id, seq] of focusSeq) {
    if (seq > bestSeq) {
      bestSeq = seq;
      bestId = id;
    }
  }
  ownerHostId = bestId;
}

function emit() {
  for (const listener of listeners) listener();
}

// Call when a host transitions INTO focus (becomes a visible chart owner
// candidate). Takes a fresh, higher sequence so this host is now the topmost.
export function acquireChartFocus(id: number) {
  seqCounter += 1;
  focusSeq.set(id, seqCounter);
  recomputeOwner();
  emit();
}

// Call when a host blurs or unmounts. The next-highest focused host takes over.
export function releaseChartFocus(id: number) {
  if (focusSeq.delete(id)) {
    recomputeOwner();
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// True when this host currently holds the singleton (topmost focused chart).
export function useIsChartOwner(id: number): boolean {
  const getSnapshot = () => ownerHostId === id;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let nextHostId = 1;
export function allocateChartHostId(): number {
  // eslint-disable-next-line no-plusplus
  return nextHostId++;
}
