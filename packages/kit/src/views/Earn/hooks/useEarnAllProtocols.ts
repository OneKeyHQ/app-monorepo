import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { parseFormattedLiquidityValue } from '../utils/availableAssetsUtils';

export type IEarnProtocolTokenRow = {
  symbol: string;
  item: IStakeProtocolListItem;
  tvlValue: number;
};

export type IEarnAggregatedProvider = {
  /** Provider identifier (server-issued name, lowercased) */
  provider: string;
  /** Display name in canonical casing (OK-59245) */
  providerName: string;
  logoURI: string;
  /** Total TVL across all vaults/tokens (USD number, for sorting/display only) */
  tvlValue: number;
  tokens: IEarnProtocolTokenRow[];
};

const FETCH_CONCURRENCY = 10;
// Cache the aggregation result for 5 minutes, matching the server-side cache
// cadence of available-assets / protocol data. Without this layer, every mount
// of the Protocols page or a protocol's Tokens page would re-fetch
// getProtocolList for every symbol (the background-layer memoize lasts only
// 5s), causing a 5s+ skeleton on each entry.
const AGGREGATED_CACHE_MAX_AGE = 5 * 60 * 1000;

function getItemTvlValue(item: IStakeProtocolListItem): number {
  return parseFormattedLiquidityValue(
    item.provider.totalFiatValue || item.provider.tvl || item.tvl?.text,
  );
}

/**
 * Worker-pool concurrent fetching (no chunk barrier): the old implementation
 * ran allSettled in groups of 5, and each group had to wait for its slowest
 * request before starting the next (bucket effect) — 30 symbols in 6 serial
 * groups easily took 3-5s. Instead, a fixed number of workers pull tasks from
 * a queue, so a fast request immediately frees its slot; total time is roughly
 * total / concurrency x average latency.
 */
async function fetchListsBySymbol(
  symbols: string[],
): Promise<Map<string, IStakeProtocolListItem[]>> {
  const listsBySymbol = new Map<string, IStakeProtocolListItem[]>();
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(FETCH_CONCURRENCY, symbols.length) },
    async () => {
      while (cursor < symbols.length) {
        const symbol = symbols[cursor];
        cursor += 1;
        try {
          listsBySymbol.set(
            symbol,
            await backgroundApiProxy.serviceStaking.getProtocolList({
              symbol,
              // Keep parity with the fast path (OK-59305): withdraw-only
              // protocols must stay reachable for users holding positions
              includeWithdrawOnly: true,
            }),
          );
        } catch {
          // Skip a failed symbol without blocking the whole page
        }
      }
    },
  );
  await Promise.all(workers);
  return listsBySymbol;
}

/** Merge a (symbol, protocol row) pair into providerMap, aggregating TVL and token rows */
function mergeItemIntoProviderMap(
  providerMap: Map<string, IEarnAggregatedProvider>,
  symbol: string,
  item: IStakeProtocolListItem,
) {
  const providerKey = item.provider.name?.toLowerCase();
  if (!providerKey) {
    return;
  }
  const tvlValue = getItemTvlValue(item);
  const existing = providerMap.get(providerKey);
  if (existing) {
    existing.tvlValue += tvlValue;
    existing.tokens.push({ symbol, item, tvlValue });
  } else {
    providerMap.set(providerKey, {
      provider: providerKey,
      // OK-59245: canonical display casing, same as the token protocol list
      providerName: getEarnProviderDisplayName(item.provider.name),
      logoURI: item.provider.logoURI,
      tvlValue,
      tokens: [{ symbol, item, tvlValue }],
    });
  }
}

/**
 * Fallback path (for old servers during rollout): `earn/v2/available-assets`
 * lists every supported (token, protocol) pair; fetch `getProtocolList` per
 * de-duplicated symbol and merge on the client. ~30 requests, 1s+ cold load.
 */
async function fetchAggregatedByFanOut(): Promise<IEarnAggregatedProvider[]> {
  const v2Assets =
    await backgroundApiProxy.serviceStaking.getAvailableAssetsV2();
  const symbols = Array.from(
    new Set(
      v2Assets
        .filter((asset) => asset.type === 'normal')
        .map((asset) => asset.symbol),
    ),
  );

  const listsBySymbol = await fetchListsBySymbol(symbols);

  const providerMap = new Map<string, IEarnAggregatedProvider>();
  for (const [symbol, items] of listsBySymbol.entries()) {
    for (const item of items) {
      mergeItemIntoProviderMap(providerMap, symbol, item);
    }
  }
  return Array.from(providerMap.values());
}

/**
 * All-protocol aggregation (OK-58505 Protocols home): prefer the single
 * full-list request — calling `stake-protocol/list` without a symbol makes the
 * server return every protocol row (supported since server 6.6.0, each row
 * carries a `symbol` field), so the client only merges by provider. If the
 * server does not support it yet (rollout-period error / empty result / rows
 * missing symbol), fall back to the per-symbol fan-out path.
 */
async function fetchAllProtocolsAggregated(): Promise<
  IEarnAggregatedProvider[]
> {
  try {
    const items = await backgroundApiProxy.serviceStaking.getAllProtocolList();
    if (items.length > 0 && items.every((item) => item.symbol)) {
      const providerMap = new Map<string, IEarnAggregatedProvider>();
      for (const item of items) {
        mergeItemIntoProviderMap(providerMap, item.symbol ?? '', item);
      }
      return Array.from(providerMap.values());
    }
  } catch {
    // Old servers reject the symbol-less request (422 validation); use fallback
  }
  return fetchAggregatedByFanOut();
}

let aggregatedCachePromise: Promise<IEarnAggregatedProvider[]> | undefined;
let aggregatedCacheTime = 0;

function getAllProtocolsAggregated({
  forceRefresh,
}: { forceRefresh?: boolean } = {}): Promise<IEarnAggregatedProvider[]> {
  const now = Date.now();
  if (
    !forceRefresh &&
    aggregatedCachePromise &&
    now - aggregatedCacheTime < AGGREGATED_CACHE_MAX_AGE
  ) {
    return aggregatedCachePromise;
  }
  aggregatedCacheTime = now;
  aggregatedCachePromise = fetchAllProtocolsAggregated().catch((error) => {
    // Do not cache failures; retry on the next page entry
    aggregatedCachePromise = undefined;
    throw error;
  });
  return aggregatedCachePromise;
}

export function useEarnAllProtocols() {
  const { result, isLoading, run } = usePromiseResult(
    () => getAllProtocolsAggregated(),
    [],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );

  const refresh = useCallback(async () => {
    await getAllProtocolsAggregated({ forceRefresh: true });
    return run();
  }, [run]);

  return {
    providers: result ?? [],
    isLoading: isLoading === true && !result,
    refresh,
  };
}
