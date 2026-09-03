import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  type IMarketIdentityResolveOptions,
  MarketAsyncStarV2,
  createCachedMarketIdentityResolver,
} from '../../../components/MarketAsyncStarV2';
import { MarketTestIDs } from '../../../testIDs';
import { selectMarketStockWatchlistVariant } from '../../../utils/stockTokenVariant';

import { getMarketStockVariantSummaryIdentities } from './MarketStockStar.utils';

const resolveMarketStockIdentity = createCachedMarketIdentityResolver({
  failureCacheTtlMs: 30_000,
  load: async (stockId: string) => {
    const response =
      await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants({
        stockId,
      });
    const variant = selectMarketStockWatchlistVariant(response);
    if (!variant) {
      return undefined;
    }
    return {
      chainId: variant.networkId,
      contractAddress: variant.contractAddress,
    };
  },
});

export function MarketStockStar({ stock }: { stock: IMarketStockPublicItem }) {
  const identities = useMemo(
    () => getMarketStockVariantSummaryIdentities(stock.variants),
    [stock.variants],
  );
  const resolveIdentity = useCallback(
    (options?: IMarketIdentityResolveOptions) =>
      resolveMarketStockIdentity(stock.stockId, options),
    [stock.stockId],
  );

  return (
    <MarketAsyncStarV2
      identities={identities}
      resolveIdentity={resolveIdentity}
      identityKey={stock.stockId}
      resolveOnMount={identities.length === 0}
      from={EWatchlistFrom.Homepage}
      tokenSymbol={stock.symbol}
      testID={MarketTestIDs.stockStarButton(stock.stockId)}
    />
  );
}
