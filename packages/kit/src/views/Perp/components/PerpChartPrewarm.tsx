import { ChartPrewarm } from '@onekeyhq/kit/src/components/TradingView/ChartWebView/ChartPrewarm';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Keeps the single shared chart WebView warm AND pre-switched to the active perps
 * pair while the user is on the perps home (which itself shows no chart — the
 * chart lives in the MobilePerpMarket sub-page). Switching the pair here updates
 * the prewarmed symbol immediately, so opening the chart sub-page is instant and
 * already on the right pair.
 *
 * Contention-free: the home has no visible chart, and when the chart sub-page is
 * pushed the home blurs so this host yields ownership to the sub-page chart.
 *
 * Native only — the prewarm WebView never loads on web/desktop/ext.
 */
export function PerpChartPrewarm() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();

  if (!platformEnv.isNative) return null;

  return (
    <ChartPrewarm symbol={activeTradeInstrument.coin} source="hyperliquid" />
  );
}

export default PerpChartPrewarm;
