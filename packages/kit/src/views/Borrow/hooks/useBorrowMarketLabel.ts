import { getBorrowMarketLabel } from '../borrowMarketDisplayName';

import { useBorrowMarkets } from './useBorrowMarkets';

/** A market's short name ("Aave Core"), from the market list */
export function useBorrowMarketLabel({
  networkId,
  marketAddress,
  enabled = true,
}: {
  networkId?: string;
  marketAddress?: string;
  enabled?: boolean;
}) {
  const { markets } = useBorrowMarkets({ isActive: enabled });
  const market = markets?.find(
    (item) =>
      item.networkId === networkId &&
      Boolean(marketAddress) &&
      item.marketAddress?.toLowerCase() === marketAddress?.toLowerCase(),
  );
  return market ? getBorrowMarketLabel(market) : undefined;
}
