// cspell:words Ondo

import { isOndoUSMarketStock } from '@onekeyhq/shared/src/utils/tradingHoursUtils';

export function isOndoStockSource(source?: string | null) {
  return isOndoUSMarketStock(source);
}
