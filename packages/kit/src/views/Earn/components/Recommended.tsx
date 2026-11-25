import { useCallback, useEffect, useRef } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';

import { RecommendedSection } from './RecommendedSection';

// OK-59247: focus revalidation window. Coming back from a detail page
// re-focuses the home and re-fired the recommend request every time, which
// re-rendered the section and made the page feel like it reloads on every
// back navigation. Within this window the last successful result is reused.
const RECOMMEND_FOCUS_REVALIDATE_WINDOW_MS = 30 * 1000;

type IRecommendedTokensResult = {
  tokens: IRecommendAsset[];
  scope: string;
};

function getRecommendedTokensCacheKey(tokens: IRecommendAsset[]) {
  return JSON.stringify(tokens);
}

function useRecommendedTokens({
  networkId,
  accountId,
  indexedAccountId,
  scope,
  enableFetch,
  refreshTrigger,
  cachedRecommendedTokens,
  onBaseRecommendedTokensLoaded,
}: {
  networkId: string;
  accountId?: string;
  indexedAccountId?: string;
  scope: string;
  enableFetch: boolean;
  /**
   * Bumped by explicit Earn refreshes (pull-to-refresh, pending-tx settlement).
   * Part of the fetch key so those refreshes bypass the focus-revalidation
   * window below — the rows carry account balances, which move exactly when
   * those refreshes fire (PR 12791 review P2).
   */
  refreshTrigger: number;
  cachedRecommendedTokens: IRecommendAsset[];
  onBaseRecommendedTokensLoaded: (
    tokens: IRecommendAsset[],
    resultScope: string,
  ) => void;
}) {
  const lastFetchRef = useRef<
    { key: string; at: number; tokens: IRecommendAsset[] } | undefined
  >(undefined);
  const requestSequenceRef = useRef(0);

  const fetchBaseRecommendedTokens = useCallback(async () => {
    if (!enableFetch) {
      return undefined;
    }
    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;

    // OK-59247: reuse the last result for focus-driven revalidation within
    // the window; account/network changes use a different key and bypass it.
    // refreshTrigger is in the key too so an explicit Earn refresh always
    // re-fetches the balances (PR 12791 review P2).
    const fetchKey = JSON.stringify([scope, refreshTrigger]);
    const last = lastFetchRef.current;
    if (
      last &&
      last.key === fetchKey &&
      last.tokens.length > 0 &&
      Date.now() - last.at < RECOMMEND_FOCUS_REVALIDATE_WINDOW_MS
    ) {
      return { tokens: last.tokens, scope };
    }

    // OK-59302: pass the active account so the server can compute the
    // per-token balances shown as the "Balance" subtitle
    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2(
        accountId || indexedAccountId
          ? { accountId: accountId ?? '', networkId, indexedAccountId }
          : undefined,
      );

    if (!recommendedAssets || !Array.isArray(recommendedAssets.tokens)) {
      throw new OneKeyLocalError('Invalid Earn recommendations response');
    }
    const { tokens } = recommendedAssets;
    if (requestSequence === requestSequenceRef.current) {
      lastFetchRef.current = { key: fetchKey, at: Date.now(), tokens };
    }
    return {
      tokens,
      scope,
    };
  }, [
    enableFetch,
    networkId,
    accountId,
    indexedAccountId,
    scope,
    refreshTrigger,
  ]);

  const { result: baseRecommendedResult, isLoading: isBaseLoading } =
    usePromiseResult<IRecommendedTokensResult | undefined>(
      fetchBaseRecommendedTokens,
      [fetchBaseRecommendedTokens],
      {
        revalidateOnFocus: true,
        watchLoading: true,
        overrideIsFocused: (isFocused) => isFocused && enableFetch,
      },
    );

  const baseRecommendedResultMatchesCurrentRefresh =
    enableFetch && baseRecommendedResult?.scope === scope;
  const freshBaseRecommendedTokens = baseRecommendedResultMatchesCurrentRefresh
    ? baseRecommendedResult.tokens
    : undefined;
  const hasSettledBaseRecommendedTokens =
    baseRecommendedResultMatchesCurrentRefresh && isBaseLoading === false;
  const baseRecommendedTokens =
    freshBaseRecommendedTokens ?? cachedRecommendedTokens;

  useEffect(() => {
    if (
      !baseRecommendedResultMatchesCurrentRefresh ||
      !freshBaseRecommendedTokens
    ) {
      return;
    }

    onBaseRecommendedTokensLoaded(freshBaseRecommendedTokens, scope);
  }, [
    baseRecommendedResultMatchesCurrentRefresh,
    freshBaseRecommendedTokens,
    onBaseRecommendedTokensLoaded,
    scope,
  ]);

  return {
    isLoading: isBaseLoading,
    recommendedTokens: baseRecommendedTokens,
    hasSettledBaseRecommendedTokens,
  };
}

export function Recommended(
  props:
    | {
        disableHorizontalBleed?: boolean;
        recommendedItemContainerProps?: IYStackProps;
        withHeader?: boolean;
        enableFetch?: boolean;
        isActive?: boolean;
      }
    | undefined,
) {
  const {
    disableHorizontalBleed = false,
    recommendedItemContainerProps,
    withHeader = true,
    enableFetch = true,
    isActive = true,
  } = props ?? {};
  const shouldFetch = enableFetch && isActive;

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const { activeAccount } = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const [
    {
      recommendedTokens: cachedRecommendedTokens = [],
      recommendedTokensScope,
      refreshTrigger = 0,
    },
  ] = useEarnAtom();
  const account = activeAccount?.account;
  const externalAccountScope =
    account && 'connectedAddresses' in account
      ? [account.connectedAddresses, account.selectedAddress]
      : undefined;
  const recommendedLoadScopeKey = JSON.stringify([
    allNetworkId,
    account?.id ?? '',
    activeAccount?.indexedAccount?.id ?? '',
    account?.addressDetail?.address ?? '',
    account?.address ?? '',
    externalAccountScope,
  ]);
  const scopedCachedTokens =
    recommendedTokensScope === recommendedLoadScopeKey
      ? cachedRecommendedTokens
      : [];

  const handleBaseRecommendedTokensLoaded = useCallback(
    (tokens: IRecommendAsset[], resultScope: string) => {
      if (
        resultScope === recommendedTokensScope &&
        getRecommendedTokensCacheKey(tokens) ===
          getRecommendedTokensCacheKey(cachedRecommendedTokens)
      ) {
        return;
      }

      actions.current.updateRecommendedTokens(tokens, resultScope);
    },
    [actions, cachedRecommendedTokens, recommendedTokensScope],
  );

  const { recommendedTokens, isLoading, hasSettledBaseRecommendedTokens } =
    useRecommendedTokens({
      networkId: allNetworkId,
      accountId: activeAccount?.account?.id,
      indexedAccountId: activeAccount?.indexedAccount?.id,
      scope: recommendedLoadScopeKey,
      enableFetch: shouldFetch,
      refreshTrigger,
      cachedRecommendedTokens: scopedCachedTokens,
      onBaseRecommendedTokensLoaded: handleBaseRecommendedTokensLoaded,
    });

  // The request is already scoped by account (see useRecommendedTokens'
  // fetchKey), but this gate was not: keyed on the network alone, switching
  // accounts left `hasCompletedInitialRecommendedLoadRef` matching, so no
  // skeleton was shown while usePromiseResult kept serving the previous
  // account's result — account B briefly read account A's balances. Scope the
  // gate the same way the request is scoped.
  const hasCompletedInitialRecommendedLoadRef = useRef<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (shouldFetch && hasSettledBaseRecommendedTokens) {
      hasCompletedInitialRecommendedLoadRef.current = recommendedLoadScopeKey;
    }
  }, [hasSettledBaseRecommendedTokens, recommendedLoadScopeKey, shouldFetch]);

  const showInitialSkeleton =
    isLoading === true &&
    recommendedTokens.length === 0 &&
    hasCompletedInitialRecommendedLoadRef.current !== recommendedLoadScopeKey;

  return (
    <RecommendedSection
      tokens={recommendedTokens}
      withHeader={withHeader}
      disableHorizontalBleed={disableHorizontalBleed}
      recommendedItemContainerProps={recommendedItemContainerProps}
      showSkeleton={showInitialSkeleton}
    />
  );
}
