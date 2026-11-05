import { useMemo, useRef } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

async function fetchHighlightQuotes(
  assets: IMarketHighlightAsset[],
  onUpdate: (quotes: Map<string, IMarketHighlightQuote>) => void,
) {
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

  const requests = [
    tokens.length > 0 &&
      limit(() =>
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
      ),
    stocks.length > 0 &&
      limit(() =>
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
      ),
    perps.length > 0 &&
      limit(() =>
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
      ),
    ...listings.map((asset) =>
      limit(async () => {
        const quote = await service.fetchMarketListingWatchlistQuote(
          asset.favorite,
        );
        if (quote) quotes.set(getMarketWatchlistKey(asset.favorite), quote);
      }),
    ),
  ];
  const results = await Promise.allSettled(
    requests
      .filter((request) => request !== false)
      .map(async (request) => {
        await request;
        if (quotes.size > 0) {
          onUpdate(new Map(quotes));
        }
      }),
  );
  if (
    results.length > 0 &&
    results.every((result) => result.status === 'rejected')
  ) {
    throw new OneKeyLocalError('All market highlight quote sources failed');
  }
  return quotes;
}

export function useMarketHighlightQuotes(
  assets: IMarketHighlightAsset[] | undefined,
  initialQuotes?: ReadonlyMap<string, IMarketHighlightQuote>,
) {
  const isMounted = useIsMounted();
  const requestRef = useRef(0);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const preview = useMemo(
    () => (initialQuotes ? new Map(initialQuotes) : undefined),
    [initialQuotes],
  );
  const { result, setResult } = usePromiseResult(
    () => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!assets) return Promise.resolve(preview);
      return fetchHighlightQuotes(assets, (quotes) => {
        if (
          isMounted.current &&
          requestRef.current === requestId &&
          assetsRef.current === assets
        ) {
          setResult((previous) => new Map([...(previous ?? []), ...quotes]));
        }
      });
    },
    [assets, isMounted, preview],
    {
      initResult: preview,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      runImmediatelyOnMount: true,
      keepResultIfError: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  return result;
}
