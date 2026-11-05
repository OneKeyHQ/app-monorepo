import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketHighlightAsset } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketTokenListBatchForPlatform } from '../MarketHomeV2/components/MarketTokenList/hooks/marketTokenBatchPlatformApi';
import { getNativeTokenInfo } from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

export type IMarketHighlightQuote = {
  logoUrl?: string;
  isUSStock?: boolean;
  price?: string;
  priceChange24hPercent?: string | number;
};

async function fetchHighlightQuotes(assets: IMarketHighlightAsset[]) {
  const service = backgroundApiProxy.serviceMarketV2;
  const quotes = new Map<string, IMarketHighlightQuote>();
  const byIdentity = new Map(
    assets.map((asset) => [getMarketWatchlistKey(asset.favorite), asset]),
  );
  const unique = [...byIdentity.values()];
  const tokens = unique.filter((asset) => asset.type === 'token');
  const stocks = unique.filter((asset) => asset.type === 'stock');
  const perps = unique.filter((asset) => asset.type === 'perp');
  const listings = unique.filter((asset) => asset.type === 'asset');
  const limit = pLimit(4);

  await Promise.allSettled([
    tokens.length > 0 &&
      fetchMarketTokenListBatchForPlatform({
        tokenAddressList: tokens.map(
          ({ chainId, contractAddress, isNative }) => ({
            chainId,
            contractAddress,
            isNative: getNativeTokenInfo(isNative, contractAddress).isNative,
          }),
        ),
      }).then(({ list }) => {
        const tokenQuotes = new Map<string, IMarketHighlightQuote>();
        list.forEach((token) => {
          const chainId = token?.networkId || token?.chainId;
          if (!chainId) return;
          const { isNative } = getNativeTokenInfo(
            token.isNative,
            token.address,
          );
          const key = getMarketWatchlistKey({
            chainId,
            contractAddress: isNative ? '' : token.address,
          });
          tokenQuotes.set(key, token);
        });
        for (const asset of tokens) {
          const { isNative } = getNativeTokenInfo(
            asset.isNative,
            asset.contractAddress,
          );
          const key = getMarketWatchlistKey({
            chainId: asset.chainId,
            contractAddress: isNative ? '' : asset.contractAddress,
          });
          const quote = tokenQuotes.get(key);
          if (quote) {
            quotes.set(getMarketWatchlistKey(asset.favorite), quote);
          }
        }
      }),
    stocks.length > 0 &&
      service
        .fetchMarketStockBatch({
          stockIds: stocks.map(({ stockId }) => stockId),
        })
        .then((items) => {
          const byStockId = new Map(
            items.map((item) => [item.stockId.toUpperCase(), item]),
          );
          for (const asset of stocks) {
            const quote = byStockId.get(asset.stockId.toUpperCase());
            if (quote) {
              quotes.set(getMarketWatchlistKey(asset.favorite), {
                ...quote,
                isUSStock: quote.tags?.includes('US'),
              });
            }
          }
        }),
    perps.length > 0 &&
      service
        .fetchMarketPerpsTokenList({ category: 'all' })
        .then(({ tokens: items }) => {
          const byCoin = new Map(items.map((item) => [item.name, item]));
          for (const asset of perps) {
            const quote = byCoin.get(asset.perpsCoin);
            if (quote) {
              quotes.set(getMarketWatchlistKey(asset.favorite), {
                logoUrl: quote.tokenImageUrl,
                price: quote.markPrice,
                priceChange24hPercent: quote.change24hPercent,
              });
            }
          }
        }),
    ...listings.map((asset) =>
      limit(async () => {
        const quote = await service.fetchMarketListingWatchlistQuote(
          asset.favorite,
        );
        if (quote) quotes.set(getMarketWatchlistKey(asset.favorite), quote);
      }),
    ),
  ]);
  return quotes;
}

export function useMarketHighlightQuotes(assets: IMarketHighlightAsset[]) {
  const { result } = usePromiseResult(
    () => fetchHighlightQuotes(assets),
    [assets],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      runImmediatelyOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  return result;
}
