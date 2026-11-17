import { useLayoutEffect, useSyncExternalStore } from 'react';

// UI-runtime only: no persistence, background communication, or native resources.
const blockers = new Set<symbol>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getIsBlocked() {
  return blockers.size > 0;
}

export function acquireDeferredGuideBlocker(): () => void {
  const blocker = Symbol('deferred-guide-blocker');
  blockers.add(blocker);
  if (blockers.size === 1) notifyListeners();
  return () => {
    if (blockers.delete(blocker) && blockers.size === 0) notifyListeners();
  };
}

export function useDeferredGuideBlocker(active: boolean) {
  useLayoutEffect(() => {
    if (active) return acquireDeferredGuideBlocker();
    return undefined;
  }, [active]);
}

export function useIsDeferredGuideBlocked() {
  return useSyncExternalStore(subscribe, getIsBlocked, getIsBlocked);
}
