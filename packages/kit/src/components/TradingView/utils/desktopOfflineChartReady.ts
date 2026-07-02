import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function getDesktopOfflineChartReady(): boolean {
  if (!platformEnv.isDesktop) {
    return false;
  }

  const globals =
    globalThis.ONEKEY_DESKTOP_GLOBALS_GETTER?.() ??
    globalThis.ONEKEY_DESKTOP_GLOBALS;
  return !!globals?.tradingViewOfflineReady;
}
