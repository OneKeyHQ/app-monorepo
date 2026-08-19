import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenDetailResponse } from '@onekeyhq/shared/types/marketV2';

const TOKEN_DETAIL_SUCCESS_CACHE_TTL_MS = 3000;
const MAX_TOKEN_DETAIL_SUCCESS_CACHE_ENTRIES = 20;

interface ITokenDetailRequestEntry {
  request: Promise<IMarketTokenDetailResponse>;
  expiresAt?: number;
}

const tokenDetailRequestEntries = new Map<string, ITokenDetailRequestEntry>();

function buildTokenDetailRequestKey({
  tokenAddress,
  networkId,
  currencyId,
}: {
  tokenAddress: string;
  networkId: string;
  currencyId: string;
}) {
  const normalizedNetworkId = networkId.trim();
  const normalizedCurrencyId = currencyId.trim().toLowerCase() || 'usd';
  const normalizedTokenAddress =
    normalizeTokenContractAddress({
      networkId: normalizedNetworkId,
      contractAddress: tokenAddress.trim(),
    }) ?? '';
  return `${normalizedNetworkId}:${normalizedTokenAddress}:${normalizedCurrencyId}`;
}

function pruneTokenDetailRequestEntries(now = Date.now()) {
  for (const [key, entry] of tokenDetailRequestEntries) {
    if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
      tokenDetailRequestEntries.delete(key);
    }
  }
}

function limitTokenDetailSuccessCache() {
  const completedEntries = [...tokenDetailRequestEntries.entries()]
    .filter(([, entry]) => entry.expiresAt !== undefined)
    .toSorted(
      ([, first], [, second]) =>
        (first.expiresAt ?? 0) - (second.expiresAt ?? 0),
    );
  const overflowCount =
    completedEntries.length - MAX_TOKEN_DETAIL_SUCCESS_CACHE_ENTRIES;
  for (let index = 0; index < overflowCount; index += 1) {
    tokenDetailRequestEntries.delete(completedEntries[index][0]);
  }
}

export function fetchMarketTokenDetailWithCache({
  tokenAddress,
  networkId,
  currencyId,
}: {
  tokenAddress: string;
  networkId: string;
  currencyId: string;
}): Promise<IMarketTokenDetailResponse> {
  pruneTokenDetailRequestEntries();
  const normalizedCurrencyId = currencyId.trim().toLowerCase() || 'usd';
  const key = buildTokenDetailRequestKey({
    tokenAddress,
    networkId,
    currencyId: normalizedCurrencyId,
  });
  const existingEntry = tokenDetailRequestEntries.get(key);
  if (existingEntry) {
    return existingEntry.request;
  }

  const request =
    backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
      tokenAddress,
      networkId,
      { currencyId: normalizedCurrencyId },
    );
  const entry: ITokenDetailRequestEntry = { request };
  tokenDetailRequestEntries.set(key, entry);

  void request.then(
    () => {
      if (tokenDetailRequestEntries.get(key) === entry) {
        entry.expiresAt = Date.now() + TOKEN_DETAIL_SUCCESS_CACHE_TTL_MS;
        pruneTokenDetailRequestEntries();
        limitTokenDetailSuccessCache();
      }
    },
    () => {
      if (tokenDetailRequestEntries.get(key) === entry) {
        tokenDetailRequestEntries.delete(key);
      }
    },
  );

  return request;
}

export function clearMarketTokenDetailRequestCache() {
  tokenDetailRequestEntries.clear();
}
