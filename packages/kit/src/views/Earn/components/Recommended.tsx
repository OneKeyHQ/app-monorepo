import { useCallback, useEffect, useRef } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';

import { RecommendedSection } from './RecommendedSection';

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
  enableFetch,
  cachedRecommendedTokens,
  onBaseRecommendedTokensLoaded,
}: {
  networkId: string;
  enableFetch: boolean;
  cachedRecommendedTokens: IRecommendAsset[];
  onBaseRecommendedTokensLoaded: (tokens: IRecommendAsset[]) => void;
}) {
  const fetchBaseRecommendedTokens = useCallback(async () => {
    if (!enableFetch) {
      return { tokens: [], networkId };
    }

    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2();

    return {
      tokens: recommendedAssets?.tokens || [],
      networkId,
    };
  }, [enableFetch, networkId]);

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
  const actions = useEarnActions();
  const [{ recommendedTokens: cachedRecommendedTokens = [] }] = useEarnAtom();

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
      enableFetch: shouldFetch,
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
