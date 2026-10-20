import { useCallback, useMemo, useRef } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBorrowHealthFactor,
  IBorrowMarketItem,
  IBorrowReserveItem,
  IRecommendAsset,
} from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { hasPositiveBorrowBalance } from '../../../Borrow/components/borrowRepayPosition.utils';
import { useBorrowMarkets } from '../../../Borrow/hooks/useBorrowMarkets';
import { isBorrowReservesPayloadUsable } from '../../../Borrow/hooks/useBorrowReserves';

import type { IEarnDesktopMarketReserves } from './earnDesktopHome.utils';

const MARKET_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ minute: 3 });
const ACCOUNT_POLLING_INTERVAL = timerUtils.getTimeDurationMs({ minute: 1 });
// No endpoint spans markets yet, so each market is asked on its own; a few at
// a time keeps a page load from queueing every request at once
const REQUEST_CONCURRENCY = 4;
const EMPTY_MARKET_LIST: IBorrowMarketItem[] = [];
const EMPTY_MARKETS: IEarnDesktopMarketReserves[] = [];
const INITIAL_MARKETS_RESULT: {
  marketsKey?: string;
  entries: typeof EMPTY_MARKETS;
} = { entries: EMPTY_MARKETS };

const getMarketsKey = (markets: IBorrowMarketItem[]) =>
  markets.map((item) => buildBorrowMarketKey(item)).join('|');

/** Every lending market with its public reserves (no account). */
export function useEarnDesktopMarkets({ isActive }: { isActive: boolean }) {
  const { markets, isLoading: isListLoading } = useBorrowMarkets({ isActive });
  const marketList = markets ?? EMPTY_MARKET_LIST;
  const marketsKey = getMarketsKey(marketList);
  // A failed request keeps the market's last good reserves
  const lastGoodRef = useRef(new Map<string, IBorrowReserveItem>());

  const { result = INITIAL_MARKETS_RESULT } = usePromiseResult(
    async () => {
      const limit = pLimit(REQUEST_CONCURRENCY);
      const entries = await Promise.all(
        marketList.map((market) =>
          limit(async (): Promise<IEarnDesktopMarketReserves> => {
            const marketKey = buildBorrowMarketKey(market);
            try {
              const reserves =
                await backgroundApiProxy.serviceStaking.getBorrowReserves({
                  provider: market.provider,
                  networkId: market.networkId,
                  marketAddress: market.marketAddress,
                });
              if (isBorrowReservesPayloadUsable(reserves)) {
                lastGoodRef.current.set(marketKey, reserves);
                return { market, reserves };
              }
            } catch {
              // Falls back to the last good reserves
            }
            return { market, reserves: lastGoodRef.current.get(marketKey) };
          }),
        ),
      );
      return { marketsKey, entries };
    },
    // marketsKey stands in for the list, which is rebuilt on every poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketsKey],
    {
      initResult: INITIAL_MARKETS_RESULT,
      pollingInterval: isActive ? MARKET_POLLING_INTERVAL : undefined,
    },
  );

  // The list has loaded, or failed and is known to be empty
  const isListReady = marketList.length > 0 || !isListLoading;
  return {
    marketList,
    isListReady,
    markets: result.entries,
    isLoaded:
      isListReady &&
      (result.marketsKey === marketsKey || result.entries.length > 0),
  };
}

export type IEarnDesktopAccountMarket = {
  market: IBorrowMarketItem;
  accountId?: string;
  reserves?: IBorrowReserveItem;
  healthFactor?: IBorrowHealthFactor;
};

const EMPTY_ACCOUNT_MARKETS: IEarnDesktopAccountMarket[] = [];
const INITIAL_ACCOUNT_RESULT: {
  scope?: string;
  marketsKey?: string;
  entries: IEarnDesktopAccountMarket[];
} = { entries: EMPTY_ACCOUNT_MARKETS };

/**
 * The account's position in each market. No endpoint spans markets yet, so
 * this asks each market for the account on that market's network. Results are
 * tagged with the account they belong to, so a switch never shows the
 * previous account's loans.
 */
export function useEarnDesktopAccountMarkets({
  markets,
  isListReady,
  isActive,
}: {
  markets: IBorrowMarketItem[];
  isListReady: boolean;
  isActive: boolean;
}) {
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const accountId = selectedAccount.othersWalletAccountId || '';
  const indexedAccountId =
    selectedAccount.indexedAccountId || indexedAccount?.id;
  const scope = `${accountId}|${indexedAccountId ?? ''}`;
  const marketsKey = getMarketsKey(markets);
  // Each market's last good answer for this account, kept when a request fails
  const lastGoodRef = useRef({
    scope,
    byMarket: new Map<string, IEarnDesktopAccountMarket>(),
  });

  const { result = INITIAL_ACCOUNT_RESULT, run } = usePromiseResult(
    async () => {
      if (lastGoodRef.current.scope !== scope) {
        lastGoodRef.current = { scope, byMarket: new Map() };
      }
      const { byMarket } = lastGoodRef.current;
      if (!accountId && !indexedAccountId) {
        return { scope, marketsKey, entries: EMPTY_ACCOUNT_MARKETS };
      }
      const limit = pLimit(REQUEST_CONCURRENCY);
      const entries = await Promise.all(
        markets.map((market) =>
          limit(async (): Promise<IEarnDesktopAccountMarket> => {
            const marketKey = buildBorrowMarketKey(market);
            const lastGood = () => byMarket.get(marketKey) ?? { market };
            try {
              const earnAccount =
                await backgroundApiProxy.serviceStaking.getEarnAccount({
                  accountId,
                  networkId: market.networkId,
                  indexedAccountId,
                });
              if (!earnAccount?.accountId) {
                // No account on this market's network
                return { market };
              }
              const marketParams = {
                provider: market.provider,
                networkId: market.networkId,
                marketAddress: market.marketAddress,
                accountId: earnAccount.accountId,
              };
              const reserves =
                await backgroundApiProxy.serviceStaking.getBorrowReserves(
                  marketParams,
                );
              if (!isBorrowReservesPayloadUsable(reserves)) {
                return lastGood();
              }
              const hasLoan = reserves.borrowed.assets.some((asset) =>
                hasPositiveBorrowBalance(asset.borrowedAmount),
              );
              const healthFactor = hasLoan
                ? await backgroundApiProxy.serviceStaking
                    .getBorrowHealthFactor(marketParams)
                    .catch(() => byMarket.get(marketKey)?.healthFactor)
                : undefined;
              const entry = {
                market,
                accountId: earnAccount.accountId,
                reserves,
                healthFactor,
              };
              byMarket.set(marketKey, entry);
              return entry;
            } catch {
              return lastGood();
            }
          }),
        ),
      );
      return { scope, marketsKey, entries };
    },
    // marketsKey stands in for the markets array, which is rebuilt on every poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, marketsKey],
    {
      initResult: INITIAL_ACCOUNT_RESULT,
      pollingInterval: isActive ? ACCOUNT_POLLING_INTERVAL : undefined,
    },
  );

  const isCurrentAccount = result.scope === scope;
  const entries = isCurrentAccount ? result.entries : EMPTY_ACCOUNT_MARKETS;
  const loans = useMemo(
    () =>
      entries.filter((entry) =>
        (entry.reserves?.borrowed?.assets ?? []).some((asset) =>
          hasPositiveBorrowBalance(asset.borrowedAmount),
        ),
      ),
    [entries],
  );
  // Asked after a transaction settles too, when this page may be underneath
  const refresh = useCallback(() => run({ alwaysSetState: true }), [run]);

  return {
    entries,
    loans,
    // A changed market list keeps the answers it has while the rest load
    isLoaded:
      isListReady &&
      isCurrentAccount &&
      (result.marketsKey === marketsKey || entries.length > 0),
    refresh,
  };
}

const EMPTY_TOKENS: IRecommendAsset[] = [];
const INITIAL_TOKENS_RESULT: { scope?: string; tokens: IRecommendAsset[] } = {
  tokens: EMPTY_TOKENS,
};

/** Held tokens Earn supports, with their balance text and best rate. */
export function useEarnDesktopWalletTokens({
  isActive,
}: {
  isActive: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount?.account?.id;
  const indexedAccountId = activeAccount?.indexedAccount?.id;
  const scope = `${accountId ?? ''}|${indexedAccountId ?? ''}`;
  const lastRef = useRef(INITIAL_TOKENS_RESULT);
  const { result = INITIAL_TOKENS_RESULT } = usePromiseResult(
    async () => {
      // The list stays as it was while the page is in the background
      if (!isActive) {
        return lastRef.current;
      }
      let tokens = EMPTY_TOKENS;
      if (accountId || indexedAccountId) {
        try {
          const response =
            await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
              accountId: accountId ?? '',
              networkId: getNetworkIdsMap().onekeyall,
              indexedAccountId,
            });
          tokens = response?.tokens ?? EMPTY_TOKENS;
        } catch {
          // Settles on the last good list, so the tile never shimmers forever
          tokens =
            lastRef.current.scope === scope
              ? lastRef.current.tokens
              : EMPTY_TOKENS;
        }
      }
      lastRef.current = { scope, tokens };
      return lastRef.current;
    },
    [accountId, indexedAccountId, isActive, scope],
    {
      initResult: INITIAL_TOKENS_RESULT,
      revalidateOnFocus: true,
    },
  );
  const isLoaded = result.scope === scope;
  return { tokens: isLoaded ? result.tokens : EMPTY_TOKENS, isLoaded };
}

// The server builds available.text as a label followed by the amount ("Active
// 220.09"); the amount itself always uses '.' and ',' (see RecommendedSection)
const AVAILABLE_NUMBER_PATTERN = /\d[\d,]*(?:\.\d+)?/;
export function extractAvailableAmount(text?: string) {
  const raw = text?.match(AVAILABLE_NUMBER_PATTERN)?.[0];
  return raw ? raw.replace(/,/g, '') : undefined;
}
