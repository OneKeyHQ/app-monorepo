import { useSyncExternalStore } from 'react';

// Whether an iOS native chart fullscreen page is open or still closing.
// A leaf module on purpose: the eager screenshot branding reads it without
// pulling the on-demand fullscreen presentation in.
let isFullscreenActive = false;
const listeners = new Set<() => void>();

export function publishTradingViewNativeFullscreenActive(active: boolean) {
  if (active === isFullscreenActive) {
    return;
  }
  isFullscreenActive = active;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getIsFullscreenActive() {
  return isFullscreenActive;
}

export function useIsTradingViewNativeFullscreenActive() {
  return useSyncExternalStore(
    subscribe,
    getIsFullscreenActive,
    getIsFullscreenActive,
  );
}
