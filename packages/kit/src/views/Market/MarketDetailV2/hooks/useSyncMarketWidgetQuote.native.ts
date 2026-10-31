import { useEffect, useMemo } from 'react';

import { throttle } from 'lodash';
import { AppState } from 'react-native';

import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import { logMarketWidgetEvent } from '@onekeyhq/shared/src/modules/MarketWidget/diagnostics';
import type { IMarketWidgetQuoteUpdate } from '@onekeyhq/shared/src/modules/MarketWidget/types';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import {
  buildMarketWidgetStockQuote,
  buildMarketWidgetTokenQuote,
} from './marketWidgetQuote';
import { useStockDetail } from './StockDetailContext';
import { useTokenDetail } from './useTokenDetail';

import type { IMarketWidgetQuoteTarget } from './marketWidgetQuote';

export function useSyncMarketWidgetQuote(target: IMarketWidgetQuoteTarget) {
  const { tokenDetail } = useTokenDetail();
  const { isStockRoute, stockDetail, stockQuoteFetchedAt } = useStockDetail();
  const sync = useMemo(
    () =>
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
      ),
    [],
  );

  const { active, assetId, networkId, tokenAddress, isNative } = target;
  useEffect(() => {
    if (!marketWidget.supportsQuoteSync()) return;
    if (!active) {
      sync.flush();
      sync.cancel();
      return;
    }
    const update = isStockRoute
      ? buildMarketWidgetStockQuote(stockDetail, stockQuoteFetchedAt)
      : buildMarketWidgetTokenQuote({
          assetId,
          networkId,
          tokenAddress,
          isNative,
          tokenDetail,
        });
    if (update) sync(update);
  }, [
    active,
    assetId,
    networkId,
    tokenAddress,
    isNative,
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
