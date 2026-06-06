import { DESKTOP_OFFLINE_CHART_ENTRY_URL } from '@onekeyhq/shared/src/consts/desktopChartConsts';

import {
  CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS,
  CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL,
} from './constants';

/**
 * Build the CONSTANT per-domain unified chart URL for the desktop in-flow host.
 *
 * Keeps only app-global params (timezone/locale/theme/platform/appVersion) and
 * injects the fixed unified scene + boot placeholder symbol, so the URL is
 * token-independent: switching tokens never changes the URL and the page never
 * reloads (the active token rides SYMBOL_CHANGE). storageNamespace is split by
 * domain (market vs perps) so the two in-flow instances keep isolated chart
 * settings. Boot type stays 'market' to match the proven native unified source;
 * perps routing is handled by SYMBOL_CHANGE source. Query-string form of the
 * native host's buildUnifiedParamsJson.
 */
export function buildUnifiedChartUrl(params: Record<string, string>): string {
  const isPerps = params.type === 'perps';
  const url = new URL(DESKTOP_OFFLINE_CHART_ENTRY_URL);
  for (const key of CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS) {
    if (params[key] !== undefined) {
      url.searchParams.set(key, params[key]);
    }
  }
  url.searchParams.set('scene', 'unified');
  url.searchParams.set('storageNamespace', isPerps ? 'perps' : 'market');
  url.searchParams.set('type', 'market');
  url.searchParams.set('symbol', CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL);
  url.searchParams.set('decimal', '2');
  url.searchParams.set('enablePerpsTradingUi', '0');
  return url.toString();
}
