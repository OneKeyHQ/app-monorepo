import { ChartWebView } from '.';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTradingViewUrl } from '../hooks';

import { CHART_WEBVIEW_MODE, CHART_WEBVIEW_SCENE } from './constants';

/**
 * Boots the single shared unified chart WebView ahead of time so the first chart
 * the user opens is instant. Mount on a screen the user reaches just before a
 * chart (market home, perps home): while it's focused this hidden host claims the
 * pooled WebView and loads the unified page (placeholder symbol). When the user
 * opens a real chart, that chart reuses the already-booted page via SYMBOL_CHANGE
 * with no reload.
 *
 * Memory: this does NOT add a second WebView — the pool is a singleton, so this
 * just creates the one shared WebView earlier (during browsing) instead of on the
 * first token tap. Switching charts afterwards reuses it (zero extra memory).
 *
 * Native + unified only; renders nothing otherwise (ChartWebView is native-only).
 */
export function ChartPrewarm() {
  const enabled =
    platformEnv.isNative &&
    CHART_WEBVIEW_MODE !== 'legacy' &&
    CHART_WEBVIEW_SCENE === 'unified';

  // App-global params only (no symbol/token) — identical to the constant unified
  // source every real chart uses, so the prewarmed page is reused without reload.
  const { params } = useTradingViewUrl({});

  if (!enabled) return null;

  return (
    <Stack
      position="absolute"
      left={-9999}
      top={-9999}
      width={1}
      height={1}
      opacity={0}
      pointerEvents="none"
    >
      {/* selfDrivenSymbol: never auto-post a symbol — it just boots the page. */}
      <ChartWebView params={params} onlineUrl="" selfDrivenSymbol flex={1} />
    </Stack>
  );
}

export default ChartPrewarm;
