import { useMemo, useRef } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketHighlightAsset } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketTokenListBatchForPlatform } from '../MarketHomeV2/components/MarketTokenList/hooks/marketTokenBatchPlatformApi';
import { getNativeTokenInfo } from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

export type IMarketHighlightQuote = {
  logoUrl?: string;
  isUSStock?: boolean;
  maxLeverage?: number;
  price?: string;
  priceChange24hPercent?: string | number;
};

type IQuoteEntries = Array<[string, IMarketHighlightQuote]>;
const PREVIEW_MAX_AGE_MS = timerUtils.getTimeDurationMs({ minute: 5 });
const pendingQuoteSources = new Map<string, Promise<unknown>>();

// Share only in-flight source requests. Each caller retains its own preview
// and applies successful omissions and failed refreshes independently.
function fetchSharedQuoteSource<T>(key: string, fetch: () => Promise<T>) {
  const pending = pendingQuoteSources.get(key);
  if (pending) return pending as Promise<T>;
  const request = Promise.resolve()
    .then(fetch)
    .finally(() => pendingQuoteSources.delete(key));
  pendingQuoteSources.set(key, request);
  return request;
}

function compactQuote({
  logoUrl,
  isUSStock,
  maxLeverage,
  price,
  priceChange24hPercent,
}: IMarketHighlightQuote): IMarketHighlightQuote {
  return { logoUrl, isUSStock, maxLeverage, price, priceChange24hPercent };
}

async function fetchHighlightQuotes(
  assets: IMarketHighlightAsset[],
  previousQuotes: ReadonlyMap<string, IMarketHighlightQuote> | undefined,
  onUpdate: (quotes: Map<string, IMarketHighlightQuote>) => void,
  locale: string,
) {
  const service = backgroundApiProxy.serviceMarketV2;
  const quotes = new Map<string, IMarketHighlightQuote>();
  const byIdentity = new Map(
    assets.map((asset) => [getMarketWatchlistKey(asset.favorite), asset]),
  );
  for (const identity of byIdentity.keys()) {
    const previous = previousQuotes?.get(identity);
    if (previous) quotes.set(identity, previous);
  }
  const unique = [...byIdentity.values()];
  const tokens = unique.filter((asset) => asset.type === 'token');
  const stocks = unique.filter((asset) => asset.type === 'stock');
  const perps = unique.filter((asset) => asset.type === 'perp');
  const listings = unique.filter((asset) => asset.type === 'asset');
  const limit = pLimit(4);

  const requests = [
    tokens.length > 0 &&
      limit(() =>
        fetchSharedQuoteSource(
          JSON.stringify([
            locale,
            'tokens',
            tokens
              .map((asset) => [
                asset.chainId,
                asset.contractAddress,
                getNativeTokenInfo(asset.isNative, asset.contractAddress)
                  .isNative,
              ])
              .toSorted(),
          ]),
          () =>
            fetchMarketTokenListBatchForPlatform({
              tokenAddressList: tokens.map(
                ({ chainId, contractAddress, isNative }) => ({
                  chainId,
                  contractAddress,
                  isNative: getNativeTokenInfo(isNative, contractAddress)
                    .isNative,
                }),
              ),
            }),
        ).then(({ list }) => {
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
            tokenQuotes.set(key, compactQuote(token));
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
            quotes.delete(getMarketWatchlistKey(asset.favorite));
            if (quote) {
              quotes.set(getMarketWatchlistKey(asset.favorite), quote);
            }
          }
        }),
      ),
    stocks.length > 0 &&
      limit(() =>
        fetchSharedQuoteSource(
          JSON.stringify([
            locale,
            'stocks',
            stocks.map((asset) => asset.stockId).toSorted(),
          ]),
          () =>
            service.fetchMarketStockBatch({
              stockIds: stocks.map(({ stockId }) => stockId),
            }),
        ).then((items) => {
          const byStockId = new Map(
            items.map((item) => [item.stockId.toUpperCase(), item]),
          );
          for (const asset of stocks) {
            const quote = byStockId.get(asset.stockId.toUpperCase());
            quotes.delete(getMarketWatchlistKey(asset.favorite));
            if (quote) {
              quotes.set(
                getMarketWatchlistKey(asset.favorite),
                compactQuote({
                  ...quote,
                  isUSStock: quote.tags?.includes('US'),
                }),
              );
            }
          }
        }),
      ),
    perps.length > 0 &&
      limit(() =>
        fetchSharedQuoteSource(JSON.stringify([locale, 'perps']), () =>
          service.fetchMarketPerpsTokenList({ category: 'all' }),
        ).then(({ tokens: items }) => {
          const byCoin = new Map(items.map((item) => [item.name, item]));
          for (const asset of perps) {
            const quote = byCoin.get(asset.perpsCoin);
            quotes.delete(getMarketWatchlistKey(asset.favorite));
            if (quote) {
              quotes.set(getMarketWatchlistKey(asset.favorite), {
                logoUrl: quote.tokenImageUrl,
                maxLeverage: quote.maxLeverage,
                price: quote.markPrice,
                priceChange24hPercent: quote.change24hPercent,
              });
            }
          }
        }),
      ),
    ...listings.map((asset) =>
      limit(async () => {
        const quote = await fetchSharedQuoteSource(
          JSON.stringify([locale, 'asset', asset.assetId]),
          () => service.fetchMarketListingWatchlistQuote(asset.favorite),
        );
        quotes.delete(getMarketWatchlistKey(asset.favorite));
        if (quote)
          quotes.set(
            getMarketWatchlistKey(asset.favorite),
            compactQuote(quote),
          );
      }),
    ),
  ];
  const results = await Promise.allSettled(
    requests
      .filter((request) => request !== false)
      .map(async (request) => {
        await request;
        onUpdate(new Map(quotes));
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
  const locale = useLocaleVariant();
  const isMounted = useIsMounted();
  const requestRef = useRef(0);
  const queryKey = useMemo(
    () =>
      assets
        ? swrKeys.marketHighlightQuotes(
            locale,
            assets.map((asset) => {
              const identity = getMarketWatchlistKey(asset.favorite);
              return asset.type === 'token'
                ? `${identity}:${getNativeTokenInfo(asset.isNative, asset.contractAddress).isNative}`
                : identity;
            }),
          )
        : undefined,
    [assets, locale],
  );
  const cachedPreview = useMemo(() => {
    if (!platformEnv.isNative || !queryKey) return undefined;
    const cached = swrCacheUtils.getWithTimestamp<IQuoteEntries>(queryKey);
    if (!cached || Date.now() - cached.updatedAt >= PREVIEW_MAX_AGE_MS)
      return undefined;
    return new Map(cached.data);
  }, [queryKey]);
  const preview = useMemo(
    () =>
      cachedPreview || initialQuotes
        ? new Map([...(cachedPreview ?? []), ...(initialQuotes ?? [])])
        : undefined,
    [cachedPreview, initialQuotes],
  );
  const quotesRef = useRef(preview);
  // Headline revalidation recreates asset objects without changing quote inputs.
  const inputRef = useRef({ assets, locale, preview, queryKey });
  inputRef.current = { assets, locale, preview, queryKey };
  const { result, setResult } = usePromiseResult(
    async () => {
      const current = inputRef.current;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!current.assets)
        return {
          queryKey,
          locale: current.locale,
          quotes: current.preview,
        };
      const quotes = await fetchHighlightQuotes(
        current.assets,
        quotesRef.current,
        (updatedQuotes) => {
          if (
            isMounted.current &&
            requestRef.current === requestId &&
            inputRef.current.queryKey === queryKey
          ) {
            setResult({
              queryKey,
              locale: current.locale,
              quotes: updatedQuotes,
            });
            if (platformEnv.isNative && queryKey) {
              swrCacheUtils.set<IQuoteEntries>(
                queryKey,
                [...updatedQuotes].map(([key, value]) => [
                  key,
                  compactQuote(value),
                ]),
              );
            }
          }
        },
        current.locale,
      );
      return { queryKey, locale: current.locale, quotes };
    },
    [queryKey, isMounted],
    {
      initResult: { queryKey, locale, quotes: preview },
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      runImmediatelyOnMount: true,
      keepResultIfError: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  const quotes = useMemo(() => {
    if (result.queryKey === queryKey) return result.quotes;
    if (!assets) return preview;
    const previous = result.locale === locale ? result.quotes : undefined;
    if (!previous && !preview) return undefined;
    const available = new Map([...(previous ?? []), ...(preview ?? [])]);
    const identities = new Set(
      assets.map((asset) => getMarketWatchlistKey(asset.favorite)),
    );
    return new Map(
      [...available].filter(([identity]) => identities.has(identity)),
    );
  }, [assets, locale, preview, queryKey, result]);
  quotesRef.current = quotes;
  return quotes;
}
