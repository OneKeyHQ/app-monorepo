import { useCallback, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type {
  IEarnRewardsPortfolioResponse,
  IEarnRewardsPortfolioStage,
} from '@onekeyhq/shared/types/staking';

import { earnPortfolioAccountScope } from '../../../utils/portfolioAccountScope';

/**
 * Pages fetched past the first one, tied to the first page they extend
 * (its scope generation and read sequence). A successful first-page refresh
 * replaces the page set even if the server returns the same asOf value.
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
  generation: number;
  readSequence?: number;
  response?: IEarnRewardsPortfolioResponse;
};

const EMPTY_PAGES: IEarnRewardsPortfolioResponse[] = [];

function baseKeyOf(read: IRewardsRead | undefined) {
  return read?.response
    ? JSON.stringify([read.scopeKey, read.generation, read.readSequence])
    : undefined;
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
  const scopeKey = JSON.stringify([
    earnPortfolioAccountScope({ account, indexedAccountId }),
    stage,
    networkIds,
  ]);
  const lastReadRef = useRef<IRewardsRead | undefined>(undefined);
  const readSequenceRef = useRef(0);
  // The scope the page is on, read as a request lands: a read of a scope
  // the page has since left must not stand in as the last read, or a
  // failed refresh of the current scope would show it empty.
  const scopeRef = useRef({ scopeKey, generation: 0 });
  if (scopeRef.current.scopeKey !== scopeKey) {
    scopeRef.current = {
      scopeKey,
      generation: scopeRef.current.generation + 1,
    };
  }
  const { generation } = scopeRef.current;

  const { result, isLoading, run } = usePromiseResult<IRewardsRead | undefined>(
    async () => {
      if (!hasAccount || !isActive) {
        return undefined;
      }
      readSequenceRef.current += 1;
      const readSequence = readSequenceRef.current;
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getRewardsPortfolio({
            accountId,
            networkId: getNetworkIdsMap().onekeyall,
            indexedAccountId,
            stage,
            networkIds,
          });
        const read = { scopeKey, generation, readSequence, response };
        if (
          scopeRef.current.generation === generation &&
          readSequenceRef.current === readSequence
        ) {
          lastReadRef.current = read;
        }
        return read;
      } catch {
        // A failed read of the scope in hand keeps what it showed; a failed
        // read of a new scope shows that scope empty rather than the
        // previous scope's rewards, or a spinner for good.
        const last = lastReadRef.current;
        return last?.scopeKey === scopeKey && last.generation === generation
          ? last
          : { scopeKey, generation };
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
      generation,
    ],
    {
      watchLoading: true,
      revalidateOnFocus: true,
    },
  );

  // A read of another scope is the previous scope's: the new one is on its
  // way, which the hook's own loading flag reports only a render later.
  const isScopeStale =
    result !== undefined &&
    (result.scopeKey !== scopeKey || result.generation !== generation);
  const read =
    result?.scopeKey === scopeKey && result.generation === generation
      ? result
      : undefined;
  const firstPage = read?.response;

  const [pagedRewards, setPagedRewards] = useState<IPagedRewards>();
  const [loadingMoreKey, setLoadingMoreKey] = useState<string>();
  const loadingMoreRequestRef = useRef<
    { request: symbol; baseKey: string } | undefined
  >(undefined);

  const baseKey = baseKeyOf(read);
  const baseKeyRef = useRef(baseKey);
  baseKeyRef.current = baseKey;
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
    if (
      !cursor ||
      !baseKey ||
      !hasAccount ||
      scopeRef.current.generation !== generation ||
      baseKeyRef.current !== baseKey ||
      loadingMoreRequestRef.current?.baseKey === baseKey
    ) {
      return;
    }
    const request = Symbol('rewardsLoadMore');
    loadingMoreRequestRef.current = { request, baseKey };
    setLoadingMoreKey(baseKey);
    try {
      const next = await backgroundApiProxy.serviceStaking.getRewardsPortfolio({
        accountId,
        networkId: getNetworkIdsMap().onekeyall,
        indexedAccountId,
        stage: rewards.stage,
        cursor,
        networkIds,
      });
      if (
        scopeRef.current.generation !== generation ||
        baseKeyRef.current !== baseKey
      )
        return;
      setPagedRewards((prev) => {
        if (
          scopeRef.current.generation !== generation ||
          baseKeyRef.current !== baseKey
        )
          return prev;
        return prev && prev.baseKey === baseKey
          ? { baseKey, pages: [...prev.pages, next] }
          : { baseKey, pages: [next] };
      });
    } catch {
      // Keep the loaded pages; the next scroll retries this cursor.
    } finally {
      if (loadingMoreRequestRef.current?.request === request) {
        loadingMoreRequestRef.current = undefined;
        setLoadingMoreKey(undefined);
      }
    }
  }, [
    rewards,
    baseKey,
    hasAccount,
    accountId,
    indexedAccountId,
    networkIds,
    generation,
  ]);

  return {
    rewards,
    isLoading: Boolean(isLoading) || isScopeStale,
    isLoadingMore: Boolean(baseKey && loadingMoreKey === baseKey),
    hasMore: Boolean(rewards?.cursor),
    loadMore,
    refresh: run,
  };
}
