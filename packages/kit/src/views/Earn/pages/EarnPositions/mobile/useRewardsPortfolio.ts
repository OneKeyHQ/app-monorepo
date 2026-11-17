import { useCallback, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type {
  IEarnRewardsPortfolioResponse,
  IEarnRewardsPortfolioStage,
} from '@onekeyhq/shared/types/staking';

/**
 * Pages fetched past the first one, tied to the first page they extend
 * (its scope + asOf). A scope change or a refresh replaces the first page,
 * so its key changes and rows of the previous page set are dropped, even
 * when a load-more request for them is still in flight.
 */
type IPagedRewards = {
  baseKey: string;
  pages: IEarnRewardsPortfolioResponse[];
};

/**
 * One read of the ledger, marked with the scope it was read for (wallet,
 * stage, network filter): the page shows a read for its own scope only, so
 * a wallet or filter switch never shows the previous scope's rewards.
 * `response` is absent when the read failed.
 */
type IRewardsRead = {
  scopeKey: string;
  response?: IEarnRewardsPortfolioResponse;
};

const EMPTY_PAGES: IEarnRewardsPortfolioResponse[] = [];

function baseKeyOf(read: IRewardsRead | undefined) {
  return read?.response ? `${read.scopeKey}:${read.response.asOf}` : undefined;
}

/**
 * One stage of the ledger rewards for the active wallet across every earn
 * account. The response also carries the claimable + pending totals over the
 * whole ledger, so the page header can be fed from whichever stage is loaded.
 * Groups page by cursor (20 per call server side); `loadMore` appends the
 * next page and `rewards.cursor` stays set while more follow. The network
 * filter goes to the server so paging stays correct under it; the totals
 * it returns are never filtered.
 */
export function useRewardsPortfolio({
  stage,
  networkIds,
  isActive,
}: {
  stage: IEarnRewardsPortfolioStage;
  networkIds: string[];
  isActive: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  // The wallet the way useEarnPortfolioPositions reads it: a wallet without
  // a network account (all networks on an HD or hardware wallet, a network
  // whose address is not created yet) still has its indexed account, and
  // the server reads every earn account of the wallet from either, over
  // every network, the way the positions are read.
  const accountId = account?.id ?? '';
  const indexedAccountId =
    account?.indexedAccountId || indexedAccount?.id || '';
  const hasAccount = Boolean(accountId || indexedAccountId);
  const scopeKey = [accountId, indexedAccountId, stage, ...networkIds].join(
    '|',
  );
  const lastReadRef = useRef<IRewardsRead | undefined>(undefined);
  // The scope the page is on, read as a request lands: a read of a scope
  // the page has since left must not stand in as the last read, or a
  // failed refresh of the current scope would show it empty.
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;

  const { result, isLoading, run } = usePromiseResult<IRewardsRead | undefined>(
    async () => {
      if (!hasAccount || !isActive) {
        return undefined;
      }
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getRewardsPortfolio({
            accountId,
            networkId: getNetworkIdsMap().onekeyall,
            indexedAccountId,
            stage,
            networkIds,
          });
        const read = { scopeKey, response };
        if (scopeKeyRef.current === scopeKey) {
          lastReadRef.current = read;
        }
        return read;
      } catch {
        // A failed read of the scope in hand keeps what it showed; a failed
        // read of a new scope shows that scope empty rather than the
        // previous scope's rewards, or a spinner for good.
        const last = lastReadRef.current;
        return last?.scopeKey === scopeKey ? last : { scopeKey };
      }
    },
    [
      hasAccount,
      accountId,
      indexedAccountId,
      stage,
      networkIds,
      isActive,
      scopeKey,
    ],
    {
      watchLoading: true,
      revalidateOnFocus: true,
    },
  );

  // A read of another scope is the previous scope's: the new one is on its
  // way, which the hook's own loading flag reports only a render later.
  const isScopeStale = result !== undefined && result.scopeKey !== scopeKey;
  const read = result?.scopeKey === scopeKey ? result : undefined;
  const firstPage = read?.response;

  const [pagedRewards, setPagedRewards] = useState<IPagedRewards>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRequestRef = useRef<symbol | undefined>(undefined);

  const baseKey = baseKeyOf(read);
  const pages =
    pagedRewards && pagedRewards.baseKey === baseKey
      ? pagedRewards.pages
      : EMPTY_PAGES;

  const rewards = useMemo(() => {
    if (!firstPage || pages.length === 0) {
      return firstPage;
    }
    return {
      ...firstPage,
      groups: [...firstPage.groups, ...pages.flatMap((page) => page.groups)],
      cursor: pages[pages.length - 1].cursor,
    };
  }, [firstPage, pages]);

  const loadMore = useCallback(async () => {
    const cursor = rewards?.cursor;
    if (!cursor || !baseKey || !hasAccount || loadingMoreRequestRef.current) {
      return;
    }
    const request = Symbol('rewardsLoadMore');
    loadingMoreRequestRef.current = request;
    setIsLoadingMore(true);
    try {
      const next = await backgroundApiProxy.serviceStaking.getRewardsPortfolio({
        accountId,
        networkId: getNetworkIdsMap().onekeyall,
        indexedAccountId,
        stage: rewards.stage,
        cursor,
        networkIds,
      });
      setPagedRewards((prev) =>
        prev && prev.baseKey === baseKey
          ? { baseKey, pages: [...prev.pages, next] }
          : { baseKey, pages: [next] },
      );
    } catch {
      // Keep the loaded pages; the next scroll retries this cursor.
    } finally {
      if (loadingMoreRequestRef.current === request) {
        loadingMoreRequestRef.current = undefined;
        setIsLoadingMore(false);
      }
    }
  }, [rewards, baseKey, hasAccount, accountId, indexedAccountId, networkIds]);

  return {
    rewards,
    isLoading: Boolean(isLoading) || isScopeStale,
    isLoadingMore,
    hasMore: Boolean(rewards?.cursor),
    loadMore,
    refresh: run,
  };
}
