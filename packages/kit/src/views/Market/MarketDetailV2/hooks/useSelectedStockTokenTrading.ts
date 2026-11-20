import { useMemo } from 'react';

import { isStockTokenVariantTradable } from '@onekeyhq/shared/src/utils/stockTokenVariant';

import { useStockDetail } from './StockDetailContext';

import type { IStockTokenTradingStatus } from '../../components/PerpsBadges';

/**
 * The selected token's trading status for the price header's status chip,
 * or undefined while the header shows the share price. Shared by the stock
 * detail page and the Trade stock panel so both read the token the same way.
 */
export function useSelectedStockTokenTrading(
  enabled: boolean,
): IStockTokenTradingStatus | undefined {
  const { selectedTokenVariant, isTokenVariantsError } = useStockDetail();
  return useMemo(
    () =>
      enabled && selectedTokenVariant
        ? {
            tradingHours: selectedTokenVariant.tradingHours,
            isTradable: isStockTokenVariantTradable(selectedTokenVariant),
            // A failed refresh keeps the last token list, so its live fields
            // are a snapshot of the past.
            isStale: isTokenVariantsError,
          }
        : undefined,
    [enabled, isTokenVariantsError, selectedTokenVariant],
  );
}
