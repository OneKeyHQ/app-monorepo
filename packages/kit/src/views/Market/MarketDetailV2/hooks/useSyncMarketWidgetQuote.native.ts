import { useEffect, useMemo, useRef } from 'react';

import { throttle } from 'lodash';
import { AppState } from 'react-native';

import { useMarketDetailChartDisplayModePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import { logMarketWidgetEvent } from '@onekeyhq/shared/src/modules/MarketWidget/diagnostics';
import type { IMarketWidgetQuoteUpdate } from '@onekeyhq/shared/src/modules/MarketWidget/types';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { getMarketWidgetAssetKey } from '../../MarketWidget/assetIdentity';

import { useReportedMarketSimpleChartRange } from './MarketSimpleChartRangeChangeContext';
import {
  buildMarketWidgetChartQuote,
  buildMarketWidgetStockQuote,
  buildMarketWidgetTokenQuote,
} from './marketWidgetQuote';
import { useStockDetail } from './StockDetailContext';
import { useTokenDetail } from './useTokenDetail';

import type { IMarketWidgetQuoteTarget } from './marketWidgetQuote';

export function useSyncMarketWidgetQuote(target: IMarketWidgetQuoteTarget) {
  const { tokenDetail } = useTokenDetail();
  const [{ mode }] = useMarketDetailChartDisplayModePersistAtom();
  const simpleRange = useReportedMarketSimpleChartRange();
  const lastQueuedChartQuote =
    useRef<IMarketWidgetQuoteUpdate['quote']>(undefined);
  const lastQueuedDetailQuote = useRef<{
    detail: IMarketTokenDetail['widgetDetailQuote'];
    proFallback: boolean;
  }>(undefined);
  const { isStockRoute, stockDetail, stockQuoteFetchedAt } = useStockDetail();
  const sync = useMemo(() => {
    const throttleSync = () =>
      throttle(
        (update: IMarketWidgetQuoteUpdate) => {
          void (async () => {
            try {
              await travelModeManager.ready;
              if (travelModeManager.isMaskingDataSync()) return;
              const changed = await marketWidget.syncQuote(update);
              logMarketWidgetEvent('quote.sync_completed', {
                changed,
                kind: update.quote.asset.kind,
              });
            } catch (error) {
              logMarketWidgetEvent('quote.sync_failed', {}, undefined, error);
            }
          })();
        },
        15_000,
        { leading: true, trailing: true },
      );
    // A chart tick must not displace a queued write to the ordinary cache.
    const detail = throttleSync();
    const chart = throttleSync();
    return {
      detail,
      chart,
      flush: () => {
        detail.flush();
        chart.flush();
      },
      cancel: () => {
        detail.cancel();
        chart.cancel();
      },
    };
  }, []);

  const { active, assetId, networkId, tokenAddress, isNative } = target;
  useEffect(() => {
    if (!marketWidget.supportsQuoteSync()) return;
    if (!active) {
      sync.flush();
      sync.cancel();
      return;
    }
    if (isStockRoute) {
      const update = buildMarketWidgetStockQuote(
        stockDetail,
        stockQuoteFetchedAt,
      );
      if (update) sync.detail(update);
      return;
    }
    const detailQuote = tokenDetail?.widgetDetailQuote;
    if (!detailQuote || !tokenDetail) return;
    const update = buildMarketWidgetTokenQuote({
      assetId,
      networkId,
      tokenAddress,
      isNative,
      tokenDetail,
    });
    if (!update) return;
    const supportsChartModeQuotes = marketWidget.supportsChartModeQuotes?.();
    const chartUpdate = supportsChartModeQuotes
      ? buildMarketWidgetChartQuote(
          update,
          mode,
          tokenDetail,
          { active, assetId, networkId, tokenAddress, isNative },
          simpleRange,
        )
      : undefined;
    if (chartUpdate) {
      const previous = lastQueuedChartQuote.current;
      const quote = chartUpdate.quote;
      if (
        previous?.chartMode === quote.chartMode &&
        previous?.fetchedAt === quote.fetchedAt &&
        previous?.detailFetchedAt === quote.detailFetchedAt &&
        getMarketWidgetAssetKey(previous.asset) ===
          getMarketWidgetAssetKey(quote.asset) &&
        previous.price === quote.price &&
        previous.change24h === quote.change24h
      )
        return;
      lastQueuedChartQuote.current = quote;
      sync.chart(chartUpdate);
    } else {
      const proFallback =
        !!supportsChartModeQuotes &&
        mode === 'pro' &&
        tokenDetail.chartPriceMode === undefined;
      const previous = lastQueuedDetailQuote.current;
      if (
        previous?.detail === detailQuote &&
        (!proFallback || previous.proFallback)
      )
        return;
      lastQueuedDetailQuote.current = { detail: detailQuote, proFallback };
      if (proFallback) update.quote.proFallbackAt = detailQuote.fetchedAt;
      sync.detail(update);
    }
  }, [
    active,
    assetId,
    networkId,
    tokenAddress,
    isNative,
    mode,
    simpleRange,
    tokenDetail,
    isStockRoute,
    stockDetail,
    stockQuoteFetchedAt,
    sync,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') sync.flush();
    });
    return () => {
      sync.flush();
      sync.cancel();
      subscription.remove();
    };
  }, [sync]);
}
