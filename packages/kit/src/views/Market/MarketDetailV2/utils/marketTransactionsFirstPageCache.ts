import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenTransactionsResponse } from '@onekeyhq/shared/types/marketV2';

export const MARKET_TRANSACTIONS_FIRST_PAGE_SIZE = 20;

const MARKET_TRANSACTIONS_FIRST_PAGE_CACHE_TTL_MS = 5000;
const MARKET_TRANSACTIONS_FIRST_PAGE_PREFETCH_RETENTION_MS = 30_000;
const MAX_MARKET_TRANSACTIONS_FIRST_PAGE_CACHE_ENTRIES = 20;

interface IMarketTransactionsFirstPageRequestEntry {
  request: Promise<IMarketTokenTransactionsResponse>;
  result?: IMarketTokenTransactionsResponse;
  expiresAt?: number;
  retainUntilConsumed?: boolean;
  retainExpiresAt?: number;
}

const marketTransactionsFirstPageRequestEntries = new Map<
  string,
  IMarketTransactionsFirstPageRequestEntry
>();

export function buildMarketTransactionsFirstPageRequestKey({
  tokenAddress,
  networkId,
}: {
  tokenAddress: string;
  networkId: string;
}) {
  const normalizedNetworkId = networkId.trim();
  const normalizedTokenAddress =
    normalizeTokenContractAddress({
      networkId: normalizedNetworkId,
      contractAddress: tokenAddress.trim(),
    }) ?? '';
  return `${normalizedNetworkId}:${normalizedTokenAddress}`;
}

function pruneMarketTransactionsFirstPageRequestEntries(now = Date.now()) {
  for (const [key, entry] of marketTransactionsFirstPageRequestEntries) {
    if (
      entry.retainUntilConsumed &&
      entry.retainExpiresAt !== undefined &&
      entry.retainExpiresAt <= now
    ) {
      entry.retainUntilConsumed = false;
      entry.retainExpiresAt = undefined;
    }
    if (
      !entry.retainUntilConsumed &&
      entry.expiresAt !== undefined &&
      entry.expiresAt <= now
    ) {
      marketTransactionsFirstPageRequestEntries.delete(key);
    }
  }
}

function consumeMarketTransactionsFirstPageEntry(
  entry: IMarketTransactionsFirstPageRequestEntry,
  now = Date.now(),
) {
  if (!entry.retainUntilConsumed) {
    return;
  }

  entry.retainUntilConsumed = false;
  entry.retainExpiresAt = undefined;
  if (entry.result) {
    entry.expiresAt = now + MARKET_TRANSACTIONS_FIRST_PAGE_CACHE_TTL_MS;
  }
}

function limitMarketTransactionsFirstPageSuccessCache() {
  const completedEntries = [
    ...marketTransactionsFirstPageRequestEntries.entries(),
  ]
    .filter(([, entry]) => entry.expiresAt !== undefined)
    .toSorted(
      ([, first], [, second]) =>
        (first.expiresAt ?? 0) - (second.expiresAt ?? 0),
    );
  const overflowCount =
    completedEntries.length - MAX_MARKET_TRANSACTIONS_FIRST_PAGE_CACHE_ENTRIES;
  for (let index = 0; index < overflowCount; index += 1) {
    marketTransactionsFirstPageRequestEntries.delete(
      completedEntries[index][0],
    );
  }
}

export function getCachedMarketTransactionsFirstPage({
  tokenAddress,
  networkId,
}: {
  tokenAddress: string;
  networkId: string;
}) {
  pruneMarketTransactionsFirstPageRequestEntries();
  return marketTransactionsFirstPageRequestEntries.get(
    buildMarketTransactionsFirstPageRequestKey({ tokenAddress, networkId }),
  )?.result;
}

function requestMarketTransactionsFirstPageWithCache({
  tokenAddress,
  networkId,
  retainUntilConsumed,
}: {
  tokenAddress: string;
  networkId: string;
  retainUntilConsumed: boolean;
}): Promise<IMarketTokenTransactionsResponse> {
  const now = Date.now();
  pruneMarketTransactionsFirstPageRequestEntries(now);
  const key = buildMarketTransactionsFirstPageRequestKey({
    tokenAddress,
    networkId,
  });
  let existingEntry = marketTransactionsFirstPageRequestEntries.get(key);
  if (
    existingEntry?.result &&
    existingEntry.expiresAt !== undefined &&
    existingEntry.expiresAt <= now
  ) {
    marketTransactionsFirstPageRequestEntries.delete(key);
    existingEntry = undefined;
  }
  if (existingEntry) {
    if (retainUntilConsumed) {
      if (!existingEntry.retainUntilConsumed) {
        existingEntry.retainUntilConsumed = true;
        existingEntry.retainExpiresAt =
          now + MARKET_TRANSACTIONS_FIRST_PAGE_PREFETCH_RETENTION_MS;
      }
    } else {
      consumeMarketTransactionsFirstPageEntry(existingEntry, now);
    }
    return existingEntry.request;
  }

  const request =
    backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions({
      tokenAddress,
      networkId,
      limit: MARKET_TRANSACTIONS_FIRST_PAGE_SIZE,
    });
  const entry: IMarketTransactionsFirstPageRequestEntry = {
    request,
    retainUntilConsumed,
    retainExpiresAt: retainUntilConsumed
      ? now + MARKET_TRANSACTIONS_FIRST_PAGE_PREFETCH_RETENTION_MS
      : undefined,
  };
  marketTransactionsFirstPageRequestEntries.set(key, entry);

  void request.then(
    (result) => {
      if (marketTransactionsFirstPageRequestEntries.get(key) === entry) {
        entry.result = result;
        entry.expiresAt =
          Date.now() + MARKET_TRANSACTIONS_FIRST_PAGE_CACHE_TTL_MS;
        pruneMarketTransactionsFirstPageRequestEntries();
        limitMarketTransactionsFirstPageSuccessCache();
      }
    },
    () => {
      if (marketTransactionsFirstPageRequestEntries.get(key) === entry) {
        marketTransactionsFirstPageRequestEntries.delete(key);
      }
    },
  );

  return request;
}

export function prefetchMarketTransactionsFirstPageWithCache({
  tokenAddress,
  networkId,
}: {
  tokenAddress: string;
  networkId: string;
}): Promise<IMarketTokenTransactionsResponse> {
  return requestMarketTransactionsFirstPageWithCache({
    tokenAddress,
    networkId,
    retainUntilConsumed: true,
  });
}

export function fetchMarketTransactionsFirstPageWithCache({
  tokenAddress,
  networkId,
}: {
  tokenAddress: string;
  networkId: string;
}): Promise<IMarketTokenTransactionsResponse> {
  return requestMarketTransactionsFirstPageWithCache({
    tokenAddress,
    networkId,
    retainUntilConsumed: false,
  });
}

export function clearMarketTransactionsFirstPageRequestCache() {
  marketTransactionsFirstPageRequestEntries.clear();
}
