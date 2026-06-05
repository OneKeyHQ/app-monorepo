import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CHART_WEBVIEW_DESKTOP_OFFLINE_ENABLED } from './constants';

/**
 * True when the desktop offline chart is usable: the flag is on AND the main
 * process bundled the offline assets + registered the onekey-chart:// handler
 * (reported via the desktop global). Drives both the offline URL routing and
 * whether the in-flow chart host is used. The global is set once at startup, so
 * a plain read at mount is correct (no reactivity needed).
 */
export function getDesktopOfflineChartReady(): boolean {
  if (!platformEnv.isDesktop || !CHART_WEBVIEW_DESKTOP_OFFLINE_ENABLED) {
    return false;
  }
  const globals =
    globalThis.ONEKEY_DESKTOP_GLOBALS_GETTER?.() ??
    globalThis.ONEKEY_DESKTOP_GLOBALS;
  return !!globals?.tradingViewOfflineReady;
}
