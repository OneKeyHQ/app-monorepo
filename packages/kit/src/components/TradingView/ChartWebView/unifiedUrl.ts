import { DESKTOP_OFFLINE_CHART_ENTRY_URL } from '@onekeyhq/shared/src/consts/desktopChartConsts';

import { TRADING_VIEW_DISABLED_FEATURES_URL_PARAM } from '../constants';

import {
  CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS,
  CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL,
  EChartUnifiedStorageNamespace,
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
  const url = new URL(DESKTOP_OFFLINE_CHART_ENTRY_URL);
  for (const key of CHART_WEBVIEW_UNIFIED_APP_GLOBAL_KEYS) {
    if (params[key] !== undefined) {
      url.searchParams.set(key, params[key]);
    }
  }
  url.searchParams.set('scene', 'unified');
  // storageNamespace: honor an explicit caller-owned namespace (e.g. the Swap
  // K-line modal's isolated 'swap-kline', which keeps its chart settings separate
  // from the market detail chart); otherwise split by domain. It is
  // token-independent, so the URL stays constant across token switches — the
  // no-reload property is preserved.
  const storageNamespace: EChartUnifiedStorageNamespace =
    (params.storageNamespace as EChartUnifiedStorageNamespace | undefined) ??
    (params.type === 'perps'
      ? EChartUnifiedStorageNamespace.Perps
      : EChartUnifiedStorageNamespace.Market);
  url.searchParams.set('storageNamespace', storageNamespace);
  url.searchParams.set('type', 'market');
  url.searchParams.set('symbol', CHART_WEBVIEW_UNIFIED_INITIAL_SYMBOL);
  url.searchParams.set('decimal', '2');
  url.searchParams.set('enablePerpsTradingUi', '0');
  // disabledFeatures: a token-independent widget boot param (e.g. the Swap modal
  // prunes the toolbar to a minimal set). Carry it through so the unified host
  // boots with the same feature set the legacy chart had, without breaking the
  // constant-URL no-reload property (it never changes on a token switch).
  const disabledFeatures = params[TRADING_VIEW_DISABLED_FEATURES_URL_PARAM];
  if (disabledFeatures !== undefined) {
    url.searchParams.set(
      TRADING_VIEW_DISABLED_FEATURES_URL_PARAM,
      disabledFeatures,
    );
  }
  return url.toString();
}
