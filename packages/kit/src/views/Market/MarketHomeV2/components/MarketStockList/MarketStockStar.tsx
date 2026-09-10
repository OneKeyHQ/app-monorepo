import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MarketListingStar } from '../../../components/MarketListingStar';
import { MarketTestIDs } from '../../../testIDs';

export function MarketStockStar({ stock }: { stock: IMarketStockPublicItem }) {
  return (
    <MarketListingStar
      kind="stock"
      listingId={stock.stockId}
      from={EWatchlistFrom.Homepage}
      tokenSymbol={stock.symbol}
      testID={MarketTestIDs.stockStarButton(stock.stockId)}
      customIconSize="$5"
    />
  );
}
