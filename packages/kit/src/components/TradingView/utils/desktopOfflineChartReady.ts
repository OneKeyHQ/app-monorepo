import { useSyncExternalStore } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const NOOP_UNSUBSCRIBE = () => {};

export function getDesktopOfflineChartReady(): boolean {
  if (!platformEnv.isDesktop) {
    return false;
  }

  const globals =
    globalThis.ONEKEY_DESKTOP_GLOBALS_GETTER?.() ??
    globalThis.ONEKEY_DESKTOP_GLOBALS;
  return !!globals?.tradingViewOfflineReady;
}

export function subscribeDesktopOfflineChartReady(
  listener: () => void,
): () => void {
  if (!platformEnv.isDesktop) {
    return NOOP_UNSUBSCRIBE;
  }
  return (
    globalThis.ONEKEY_DESKTOP_GLOBALS_SUBSCRIBE?.(listener) ?? NOOP_UNSUBSCRIBE
  );
}

export function useDesktopOfflineChartReady(): boolean {
  return useSyncExternalStore(
    subscribeDesktopOfflineChartReady,
    getDesktopOfflineChartReady,
    () => false,
  );
}
