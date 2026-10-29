import { useCallback, useMemo, useRef, useState } from 'react';

import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBorrowHealthFactor,
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { hasPositiveBorrowBalance } from '../../../Borrow/components/borrowRepayPosition.utils';
import { useBorrowMarkets } from '../../../Borrow/hooks/useBorrowMarkets';
import { isBorrowReservesPayloadUsable } from '../../../Borrow/hooks/useBorrowReserves';
import {
  keepFirstFrame,
  readFirstFrame,
} from '../../pages/EarnRouter/earnFirstFrameCache';

import { sumWalletHoldings } from './earnDesktopHome.utils';
import { useContentStable } from './useContentStable';

import type {
  IEarnDesktopMarketReserves,
  IEarnDesktopWalletHolding,
  IEarnDesktopWalletNetworkGroup,
  IEarnDesktopWalletTokenGroup,
} from './earnDesktopHome.utils';

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

  // Every poll answers with new objects; equal reserves keep the old ones
  const reserves = useContentStable(result.entries);
  // The list has loaded, or failed and is known to be empty
  const isListReady = marketList.length > 0 || !isListLoading;
  return {
    marketList,
    isListReady,
    markets: reserves,
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
type IAccountMarketsResult = {
  scope?: string;
  marketsKey?: string;
  entries: IEarnDesktopAccountMarket[];
};
const INITIAL_ACCOUNT_RESULT: IAccountMarketsResult = {
  entries: EMPTY_ACCOUNT_MARKETS,
};
// Each account's last answers, in memory: a page opened from the DeFi home
// (My portfolio) starts with them while it asks again, so its totals agree
// with the home's from the first frame
const accountMarketsMemory = new Map<string, IAccountMarketsResult>();

/**
 * What the DeFi home last read for the selected account in one market, for a
 * page it opens (a reserve's supply page) to start from while it asks again
 */
export function useRememberedAccountMarket(
  marketKey: string,
): IEarnDesktopAccountMarket | undefined {
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const indexedAccountId =
    selectedAccount.indexedAccountId || indexedAccount?.id;
  // The home's scope for the account, as useEarnDesktopAccountMarkets keys it
  const scope = `${selectedAccount.othersWalletAccountId || ''}|${
    indexedAccountId ?? ''
  }`;
  return accountMarketsMemory
    .get(scope)
    ?.entries.find((entry) => buildBorrowMarketKey(entry.market) === marketKey);
}

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
  const remembered = accountMarketsMemory.get(scope);
  // Each market's last good answer for this account, kept when a request fails
  const lastGoodRef = useRef({
    scope,
    byMarket: new Map<string, IEarnDesktopAccountMarket>(
      (remembered?.entries ?? []).map((entry) => [
        buildBorrowMarketKey(entry.market),
        entry,
      ]),
    ),
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
              const lastGoodHealthFactor = () =>
                byMarket.get(marketKey)?.healthFactor;
              // The server sometimes answers with an empty object; the market
              // keeps the last health factor it had
              const healthFactor = hasLoan
                ? await backgroundApiProxy.serviceStaking
                    .getBorrowHealthFactor(marketParams)
                    .then((data) =>
                      data?.healthFactor?.text ? data : lastGoodHealthFactor(),
                    )
                    .catch(lastGoodHealthFactor)
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
      const answer = { scope, marketsKey, entries };
      accountMarketsMemory.set(scope, answer);
      return answer;
    },
    // marketsKey stands in for the markets array, which is rebuilt on every poll
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, marketsKey],
    {
      initResult: remembered ?? INITIAL_ACCOUNT_RESULT,
      pollingInterval: isActive ? ACCOUNT_POLLING_INTERVAL : undefined,
    },
  );

  const isCurrentAccount = result.scope === scope;
  // Every poll answers with new objects; equal positions keep the old ones
  const entries = useContentStable(
    isCurrentAccount ? result.entries : EMPTY_ACCOUNT_MARKETS,
  );
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
    // Whose markets these are, for what is remembered per account
    accountScope: scope,
    // A changed market list keeps the answers it has while the rest load
    isLoaded:
      isListReady &&
      isCurrentAccount &&
      (result.marketsKey === marketsKey || entries.length > 0),
    refresh,
  };
}

type IWalletAccount = { accountId: string; networkId: string };
type IWalletCache = {
  scope?: string;
  accounts: IWalletAccount[];
  groups: Map<string, IEarnDesktopWalletTokenGroup>;
  hasTokens: boolean;
};
type IWalletFreshGroup = {
  group: IEarnDesktopWalletTokenGroup;
  fetchedAt: number;
};
type IWalletFresh = {
  scope?: string;
  groups: Map<string, IWalletFreshGroup>;
};
const INITIAL_WALLET_CACHE: IWalletCache = {
  accounts: [],
  groups: new Map(),
  hasTokens: false,
};
const INITIAL_WALLET_FRESH: IWalletFresh = { groups: new Map() };
const EMPTY_HOLDINGS = new Map<string, IEarnDesktopWalletHolding>();
const EMPTY_NETWORK_GROUPS: IEarnDesktopWalletNetworkGroup[] = [];
// Names these fetches for aborts and logs
const WALLET_HOLDINGS_FLAG = 'earn-desktop-home-holdings';
// A list this recent is kept when the page regains focus or another network
// joins the Earn lists; a settled transaction fetches every list again
const WALLET_LIST_MAX_AGE = timerUtils.getTimeDurationMs({ seconds: 30 });

const walletGroupKey = ({ accountId, networkId }: IWalletAccount) =>
  `${accountId}|${networkId}`;

/**
 * What the wallet holds of each token across networks, with its value. The
 * wallet home's cached lists answer at once; the networks Earn offers on are
 * then fetched again, so the balances this page acts on are current.
 */
export function useEarnDesktopWalletHoldings({
  isActive,
  refreshNetworkIds,
}: {
  isActive: boolean;
  /** Networks fetched again after the cache, sorted so the key holds still */
  refreshNetworkIds: string[];
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount?.account?.id;
  const indexedAccountId = activeAccount?.indexedAccount?.id;
  const scope = `${accountId ?? ''}|${indexedAccountId ?? ''}`;
  // Another view's lists for this account (the home's, for the deposit
  // modal) start this one loaded; its own fetches then replace them
  const cacheKey = `wallet-cache:${scope}`;
  const freshKey = `wallet-fresh:${scope}`;
  const [keptCache] = useState(
    () => readFirstFrame<IWalletCache>(cacheKey) ?? INITIAL_WALLET_CACHE,
  );
  const [keptFresh] = useState(
    () => readFirstFrame<IWalletFresh>(freshKey) ?? INITIAL_WALLET_FRESH,
  );

  const cacheRef = useRef(keptCache);
  const { result: cache = INITIAL_WALLET_CACHE, run: runCache } =
    usePromiseResult(
      async () => {
        // The numbers stay as they were while the page is in the background
        if (!isActive) {
          return cacheRef.current;
        }
        let next: IWalletCache = {
          scope,
          accounts: [],
          groups: new Map(),
          hasTokens: false,
        };
        if (accountId || indexedAccountId) {
          try {
            const { accountsInfo } =
              await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
                accountId: accountId ?? '',
                indexedAccountId,
                networkId: getNetworkIdsMap().onekeyall,
                deriveType: undefined,
                // The wallet home's rule: imported and watched accounts
                // keep networks the user turned off
                networksEnabledOnly: !accountUtils.isOthersAccount({
                  accountId: accountId ?? '',
                }),
                excludeTestNetwork: true,
              });
            const locals =
              await backgroundApiProxy.serviceToken.getAccountsLocalTokens({
                accounts: accountsInfo.map((item) => ({
                  accountId: item.accountId,
                  networkId: item.networkId,
                  accountAddress: item.apiAddress,
                  xpub: item.accountXpub,
                })),
              });
            const groups = new Map<string, IEarnDesktopWalletTokenGroup>();
            locals.forEach((local) => {
              if (local) {
                groups.set(walletGroupKey(local), {
                  tokens: [...local.tokenList, ...local.smallBalanceTokenList],
                  map: local.tokenListMap,
                });
              }
            });
            next = {
              scope,
              accounts: accountsInfo.map((item) => ({
                accountId: item.accountId,
                networkId: item.networkId,
              })),
              groups,
              hasTokens: Array.from(groups.values()).some(
                (group) => group.tokens.length > 0,
              ),
            };
          } catch {
            // Settles on what it had, so the tiles never shimmer forever
            if (cacheRef.current.scope === scope) {
              next = cacheRef.current;
            }
          }
        }
        cacheRef.current = next;
        if (next.scope === scope) {
          keepFirstFrame(cacheKey, next);
        }
        return next;
      },
      [accountId, cacheKey, indexedAccountId, isActive, scope],
      {
        initResult: keptCache,
        revalidateOnFocus: true,
      },
    );

  const refreshKey = refreshNetworkIds.join(',');
  const freshRef = useRef(keptFresh);
  const freshRunRef = useRef(0);
  // Set by refresh(), so the next pass skips the age check
  const isForcedRef = useRef(false);
  const { result: fresh = INITIAL_WALLET_FRESH } = usePromiseResult(
    async () => {
      if (!isActive || cache.scope !== scope) {
        return freshRef.current;
      }
      freshRunRef.current += 1;
      const run = freshRunRef.current;
      const isForced = isForcedRef.current;
      isForcedRef.current = false;
      const wanted = new Set(refreshKey ? refreshKey.split(',') : []);
      const previous =
        freshRef.current.scope === scope ? freshRef.current.groups : undefined;
      const now = Date.now();
      const groups = new Map<string, IWalletFreshGroup>();
      const stale: IWalletAccount[] = [];
      cache.accounts
        .filter((item) => wanted.has(item.networkId))
        .forEach((item) => {
          const kept = previous?.get(walletGroupKey(item));
          if (kept && !isForced && now - kept.fetchedAt < WALLET_LIST_MAX_AGE) {
            groups.set(walletGroupKey(item), kept);
          } else {
            stale.push(item);
          }
        });
      const limit = pLimit(REQUEST_CONCURRENCY);
      await Promise.all(
        stale.map((item) =>
          limit(async () => {
            const key = walletGroupKey(item);
            try {
              const response =
                await backgroundApiProxy.serviceToken.fetchAccountTokens({
                  accountId: item.accountId,
                  networkId: item.networkId,
                  indexedAccountId,
                  flag: WALLET_HOLDINGS_FLAG,
                  hideSmallBalanceTokens: false,
                  hideRiskTokens: true,
                  excludeDeFiMarkedTokens: true,
                  saveToLocal: false,
                  isManualRefresh: false,
                });
              groups.set(key, {
                group: {
                  tokens: [
                    ...response.tokens.data,
                    ...response.smallBalanceTokens.data,
                  ],
                  map: {
                    ...response.tokens.map,
                    ...response.smallBalanceTokens.map,
                  },
                },
                fetchedAt: Date.now(),
              });
            } catch {
              // A network that fails keeps its last list, else the cache's
              const kept = previous?.get(key);
              if (kept) {
                groups.set(key, kept);
              }
            }
          }),
        ),
      );
      const next: IWalletFresh = { scope, groups };
      // A slower, older pass must not replace a newer one's lists
      if (run === freshRunRef.current) {
        freshRef.current = next;
        keepFirstFrame(freshKey, next);
      }
      return next;
    },
    [cache, freshKey, indexedAccountId, isActive, refreshKey, scope],
    { initResult: keptFresh },
  );

  const derived = useMemo(() => {
    if (cache.scope !== scope) {
      return {
        holdings: EMPTY_HOLDINGS,
        networkGroups: EMPTY_NETWORK_GROUPS,
      };
    }
    const groups = new Map(cache.groups);
    if (fresh.scope === scope) {
      fresh.groups.forEach((item, key) => groups.set(key, item.group));
    }
    return {
      holdings: sumWalletHoldings(Array.from(groups.values())),
      // The same lists a network at a time, for the rows per network
      networkGroups: Array.from(
        groups,
        ([key, group]): IEarnDesktopWalletNetworkGroup => {
          const split = key.lastIndexOf('|');
          return {
            ...group,
            accountId: key.slice(0, split),
            networkId: key.slice(split + 1),
          };
        },
      ),
    };
  }, [cache, fresh, scope]);
  // A refetch on focus answers with the same balances as new objects
  const holdings = useContentStable(derived.holdings);
  const networkGroups = useContentStable(derived.networkGroups);

  // A settled transaction moves wallet balances too
  const refresh = useCallback(() => {
    isForcedRef.current = true;
    return runCache({ alwaysSetState: true });
  }, [runCache]);

  // Cached numbers show at once and the fetch corrects them quietly. With no
  // cache the page waits for the first fetch; networks the Earn lists add
  // later update the numbers in place
  const isLoaded =
    cache.scope === scope &&
    (cache.hasTokens || !refreshKey || fresh.scope === scope);

  return { holdings, networkGroups, isLoaded, refresh };
}
