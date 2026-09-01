import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MarketAsyncStarV2 } from '../../../components/MarketAsyncStarV2';
import { MarketTestIDs } from '../../../testIDs';
import { selectMarketStockWatchlistVariant } from '../../../utils/stockTokenVariant';

import { getMarketStockVariantSummaryIdentities } from './MarketStockStar.utils';

export function MarketStockStar({ stock }: { stock: IMarketStockPublicItem }) {
  const identities = useMemo(
    () => getMarketStockVariantSummaryIdentities(stock.variants),
    [stock.variants],
  );
  const resolveIdentity = useCallback(async () => {
    const response =
      await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants({
        stockId: stock.stockId,
      });
    const variant = selectMarketStockWatchlistVariant(response);
    if (!variant) {
      return undefined;
    }
    return {
      chainId: variant.networkId,
      contractAddress: variant.contractAddress,
    };
  }, [stock.stockId]);

  return (
    <MarketAsyncStarV2
      identities={identities}
      resolveIdentity={resolveIdentity}
      from={EWatchlistFrom.Homepage}
      tokenSymbol={stock.symbol}
      testID={MarketTestIDs.stockStarButton(stock.stockId)}
    />
  );
}
