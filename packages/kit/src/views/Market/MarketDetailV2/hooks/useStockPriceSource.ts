import { useStockDetail } from './StockDetailContext';

export { resolveDisplayedStockPriceMode } from './stockPriceSourceState';

export function useStockPriceSource() {
  return useStockDetail().priceSource;
}
