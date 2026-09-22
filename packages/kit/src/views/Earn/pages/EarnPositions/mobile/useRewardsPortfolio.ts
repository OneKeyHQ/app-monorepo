import { useCallback, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IEarnRewardsPortfolioResponse,
  IEarnRewardsPortfolioStage,
} from '@onekeyhq/shared/types/staking';

/**
 * Pages fetched past the first one, tied to the first page they extend
 * (stage + asOf). A stage switch or a refresh replaces the first page, so
 * its key changes and rows of the previous page set are dropped, even when
 * a load-more request for them is still in flight.
 */
type IPagedRewards = {
  baseKey: string;
  pages: IEarnRewardsPortfolioResponse[];
};

const EMPTY_PAGES: IEarnRewardsPortfolioResponse[] = [];

function baseKeyOf(rewards: IEarnRewardsPortfolioResponse | undefined) {
  return rewards ? `${rewards.stage}:${rewards.asOf}` : undefined;
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
  const accountId = activeAccount.account?.id;
  const networkId = activeAccount.network?.id;
  const indexedAccountId = activeAccount.indexedAccount?.id;

  const { result, isLoading, run } = usePromiseResult<
    IEarnRewardsPortfolioResponse | undefined
  >(
    async () => {
      if (!accountId || !networkId || !isActive) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getRewardsPortfolio({
        accountId,
        networkId,
        indexedAccountId,
        stage,
        networkIds,
      });
    },
    [accountId, networkId, indexedAccountId, stage, networkIds, isActive],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const [pagedRewards, setPagedRewards] = useState<IPagedRewards>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRequestRef = useRef<symbol | undefined>(undefined);

  const baseKey = baseKeyOf(result);
  const pages =
    pagedRewards && pagedRewards.baseKey === baseKey
      ? pagedRewards.pages
      : EMPTY_PAGES;

  const rewards = useMemo(() => {
    if (!result || pages.length === 0) {
      return result;
    }
    return {
      ...result,
      groups: [...result.groups, ...pages.flatMap((page) => page.groups)],
      cursor: pages[pages.length - 1].cursor,
    };
  }, [result, pages]);

  const loadMore = useCallback(async () => {
    const cursor = rewards?.cursor;
    if (
      !cursor ||
      !baseKey ||
      !accountId ||
      !networkId ||
      loadingMoreRequestRef.current
    ) {
      return;
    }
    const request = Symbol('rewardsLoadMore');
    loadingMoreRequestRef.current = request;
    setIsLoadingMore(true);
    try {
      const next = await backgroundApiProxy.serviceStaking.getRewardsPortfolio({
        accountId,
        networkId,
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
  }, [rewards, baseKey, accountId, networkId, indexedAccountId, networkIds]);

  return {
    rewards,
    isLoading: Boolean(isLoading),
    isLoadingMore,
    hasMore: Boolean(rewards?.cursor),
    loadMore,
    refresh: run,
  };
}
