import { useCallback, useEffect, useRef } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
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
  networkId: string;
};

function getRecommendedTokensCacheKey(tokens: IRecommendAsset[]) {
  return tokens
    .map((token) =>
      [
        token.symbol,
        token.aprWithoutFee,
        token.protocols
          .map((protocol) =>
            [protocol.networkId, protocol.provider, protocol.vault ?? ''].join(
              ':',
            ),
          )
          .join(','),
      ].join('|'),
    )
    .join(';');
}

function useRecommendedTokens({
  networkId,
  accountId,
  indexedAccountId,
  enableFetch,
  refreshTrigger,
  cachedRecommendedTokens,
  onBaseRecommendedTokensLoaded,
}: {
  networkId: string;
  accountId?: string;
  indexedAccountId?: string;
  enableFetch: boolean;
  /**
   * Bumped by explicit Earn refreshes (pull-to-refresh, pending-tx settlement).
   * Part of the fetch key so those refreshes bypass the focus-revalidation
   * window below — the rows carry account balances, which move exactly when
   * those refreshes fire (PR 12791 review P2).
   */
  refreshTrigger: number;
  cachedRecommendedTokens: IRecommendAsset[];
  onBaseRecommendedTokensLoaded: (tokens: IRecommendAsset[]) => void;
}) {
  const lastFetchRef = useRef<
    { key: string; at: number; tokens: IRecommendAsset[] } | undefined
  >(undefined);

  const fetchBaseRecommendedTokens = useCallback(async () => {
    if (!enableFetch) {
      return { tokens: [], networkId };
    }

    // OK-59247: reuse the last result for focus-driven revalidation within
    // the window; account/network changes use a different key and bypass it.
    // refreshTrigger is in the key too so an explicit Earn refresh always
    // re-fetches the balances (PR 12791 review P2).
    const fetchKey = `${networkId}|${accountId ?? ''}|${
      indexedAccountId ?? ''
    }|${refreshTrigger}`;
    const last = lastFetchRef.current;
    if (
      last &&
      last.key === fetchKey &&
      last.tokens.length > 0 &&
      Date.now() - last.at < RECOMMEND_FOCUS_REVALIDATE_WINDOW_MS
    ) {
      return { tokens: last.tokens, networkId };
    }

    // OK-59302: pass the active account so the server can compute the
    // per-token balances shown as the "Balance" subtitle
    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2(
        accountId || indexedAccountId
          ? { accountId: accountId ?? '', networkId, indexedAccountId }
          : undefined,
      );

    const tokens = recommendedAssets?.tokens || [];
    lastFetchRef.current = { key: fetchKey, at: Date.now(), tokens };
    return {
      tokens,
      networkId,
    };
  }, [enableFetch, networkId, accountId, indexedAccountId, refreshTrigger]);

  const {
    result: baseRecommendedResult = { tokens: [], networkId: '' },
    isLoading: isBaseLoading,
  } = usePromiseResult<IRecommendedTokensResult>(
    fetchBaseRecommendedTokens,
    [fetchBaseRecommendedTokens],
    {
      initResult: { tokens: [], networkId: '' },
      revalidateOnFocus: true,
      watchLoading: true,
      overrideIsFocused: (isFocused) => isFocused && enableFetch,
    },
  );

  const freshBaseRecommendedTokens = baseRecommendedResult.tokens;
  const baseRecommendedResultMatchesCurrentRefresh =
    enableFetch && baseRecommendedResult.networkId === networkId;
  const hasSettledBaseRecommendedTokens =
    baseRecommendedResultMatchesCurrentRefresh && isBaseLoading === false;
  const canUseCachedRecommendedTokens =
    cachedRecommendedTokens.length > 0 &&
    !hasSettledBaseRecommendedTokens &&
    freshBaseRecommendedTokens.length === 0;
  const baseRecommendedTokens = canUseCachedRecommendedTokens
    ? cachedRecommendedTokens
    : freshBaseRecommendedTokens;

  useEffect(() => {
    if (!baseRecommendedResultMatchesCurrentRefresh) {
      return;
    }

    onBaseRecommendedTokensLoaded(freshBaseRecommendedTokens);
  }, [
    baseRecommendedResultMatchesCurrentRefresh,
    freshBaseRecommendedTokens,
    onBaseRecommendedTokensLoaded,
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
    { recommendedTokens: cachedRecommendedTokens = [], refreshTrigger = 0 },
  ] = useEarnAtom();

  const handleBaseRecommendedTokensLoaded = useCallback(
    (tokens: IRecommendAsset[]) => {
      if (
        getRecommendedTokensCacheKey(tokens) ===
        getRecommendedTokensCacheKey(cachedRecommendedTokens)
      ) {
        return;
      }

      actions.current.updateRecommendedTokens(tokens);
    },
    [actions, cachedRecommendedTokens],
  );

  const { recommendedTokens, isLoading, hasSettledBaseRecommendedTokens } =
    useRecommendedTokens({
      networkId: allNetworkId,
      accountId: activeAccount?.account?.id,
      indexedAccountId: activeAccount?.indexedAccount?.id,
      enableFetch: shouldFetch,
      refreshTrigger,
      cachedRecommendedTokens,
      onBaseRecommendedTokensLoaded: handleBaseRecommendedTokensLoaded,
    });

  const recommendedLoadScopeKey = allNetworkId;
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
