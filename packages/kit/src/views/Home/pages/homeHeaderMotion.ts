import { useSyncExternalStore } from 'react';

// A part of the native Home header that animates its height (the banner
// stack folding away) marks the motion. Meanwhile the header drops its
// reserved minimum height so it can follow, the home page holds its
// header-height hint (whose update re-renders the whole page), and the pager
// follows the header's layout frame by frame; the hint lands when it ends.

let activeMotions = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function beginHomeHeaderMotion() {
  activeMotions += 1;
  if (activeMotions === 1) notify();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeMotions = Math.max(0, activeMotions - 1);
    if (!activeMotions) notify();
  };
}

export function isHomeHeaderInMotion() {
  return activeMotions > 0;
}

export function subscribeHomeHeaderMotion(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHomeHeaderInMotion() {
  return useSyncExternalStore(subscribeHomeHeaderMotion, isHomeHeaderInMotion);
}
