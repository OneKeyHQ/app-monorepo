import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { useRecommendedRefreshTrigger } from '../hooks/useRecommendedRefreshTrigger';

import { RecommendedSection } from './RecommendedSection';

type IRecommendedTokensResult = {
  tokens: IRecommendAsset[];
  refreshVersion: number;
};

type IAccountRecommendedTokensResult = IRecommendedTokensResult & {
  accountKey: string;
  scopeNetworkKey: string;
};

function getRecommendedTokensCacheKey(tokens: IRecommendAsset[]) {
  return tokens
    .map((token) =>
      [
        token.symbol,
        token.aprWithoutFee,
        token.available.text,
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

function getRecommendedProtocolNetworkIds(tokens: IRecommendAsset[]) {
  const networkIds = new Set<string>();
  tokens.forEach((token) => {
    token.protocols.forEach((protocol) => {
      networkIds.add(protocol.networkId);
    });
  });
  return Array.from(networkIds).toSorted();
}

function useRecommendedTokens({
  accountId,
  indexedAccountId,
  networkId,
  enableFetch,
  refreshVersion,
  cachedRecommendedTokens,
  onBaseRecommendedTokensLoaded,
}: {
  accountId?: string;
  indexedAccountId?: string;
  networkId: string;
  enableFetch: boolean;
  refreshVersion: number;
  cachedRecommendedTokens: IRecommendAsset[];
  onBaseRecommendedTokensLoaded: (tokens: IRecommendAsset[]) => void;
}) {
  const fetchBaseRecommendedTokens = useCallback(async () => {
    if (!enableFetch) {
      return { tokens: [], refreshVersion };
    }

    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
        accountId: '',
        networkId,
      });

    return {
      tokens: recommendedAssets?.tokens || [],
      refreshVersion,
    };
  }, [enableFetch, networkId, refreshVersion]);

  const {
    result: baseRecommendedResult = { tokens: [], refreshVersion: -1 },
    isLoading: isBaseLoading,
  } = usePromiseResult<IRecommendedTokensResult>(
    fetchBaseRecommendedTokens,
    [fetchBaseRecommendedTokens],
    {
      initResult: { tokens: [], refreshVersion: -1 },
      revalidateOnFocus: true,
      watchLoading: true,
      overrideIsFocused: (isFocused) => isFocused && enableFetch,
    },
  );

  const freshBaseRecommendedTokens = baseRecommendedResult.tokens;
  const baseRecommendedResultMatchesCurrentRefresh =
    enableFetch && baseRecommendedResult.refreshVersion === refreshVersion;
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

  const recommendedNetworkIds = useMemo(
    () => getRecommendedProtocolNetworkIds(baseRecommendedTokens),
    [baseRecommendedTokens],
  );
  const recommendedNetworkScopeKey = recommendedNetworkIds.join('|');
  const accountKey = `${accountId ?? ''}|${indexedAccountId ?? ''}`;
  const shouldFetchAccountRecommendedTokens =
    enableFetch &&
    Boolean(accountId) &&
    hasSettledBaseRecommendedTokens &&
    recommendedNetworkIds.length > 0;

  const fetchAccountRecommendedTokens = useCallback(async () => {
    if (!shouldFetchAccountRecommendedTokens) {
      return {
        accountKey,
        scopeNetworkKey: recommendedNetworkScopeKey,
        tokens: [],
        refreshVersion,
      };
    }

    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
        accountId: accountId ?? '',
        networkId,
        indexedAccountId,
        scopeNetworkIds: recommendedNetworkIds,
      });

    return {
      accountKey,
      scopeNetworkKey: recommendedNetworkScopeKey,
      tokens: recommendedAssets?.tokens || [],
      refreshVersion,
    };
  }, [
    accountKey,
    accountId,
    indexedAccountId,
    networkId,
    recommendedNetworkIds,
    recommendedNetworkScopeKey,
    refreshVersion,
    shouldFetchAccountRecommendedTokens,
  ]);

  const {
    result: accountRecommendedResult = {
      accountKey: '',
      scopeNetworkKey: '',
      tokens: [],
      refreshVersion: -1,
    },
    isLoading: isAccountLoading,
  } = usePromiseResult<IAccountRecommendedTokensResult>(
    fetchAccountRecommendedTokens,
    [fetchAccountRecommendedTokens],
    {
      initResult: {
        accountKey: '',
        scopeNetworkKey: '',
        tokens: [],
        refreshVersion: -1,
      },
      revalidateOnFocus: true,
      watchLoading: true,
      overrideIsFocused: (isFocused) =>
        isFocused && shouldFetchAccountRecommendedTokens,
    },
  );

  const accountRecommendedResultMatchesAccountScope =
    accountRecommendedResult.scopeNetworkKey === recommendedNetworkScopeKey &&
    accountRecommendedResult.accountKey === accountKey;
  const accountRecommendedResultMatchesCurrentScope =
    accountRecommendedResult.refreshVersion === refreshVersion &&
    accountRecommendedResultMatchesAccountScope;
  const hasSettledAccountRecommendedTokens =
    shouldFetchAccountRecommendedTokens &&
    accountRecommendedResultMatchesCurrentScope &&
    isAccountLoading === false;
  const accountRecommendedTokens = accountRecommendedResult.tokens;
  const hasAccountRecommendedTokens =
    Boolean(accountId) &&
    accountRecommendedResultMatchesAccountScope &&
    accountRecommendedTokens.length > 0;
  // Keep the previous account-scoped balances visible while the next refresh is in flight.
  const canUseAccountRecommendedTokens =
    hasAccountRecommendedTokens &&
    (accountRecommendedResultMatchesCurrentScope ||
      !hasSettledAccountRecommendedTokens);
  const recommendedTokens = canUseAccountRecommendedTokens
    ? accountRecommendedTokens
    : baseRecommendedTokens;

  return {
    isLoading: isBaseLoading,
    isBalanceLoading:
      Boolean(accountId) &&
      baseRecommendedTokens.length > 0 &&
      !canUseAccountRecommendedTokens &&
      (!hasSettledBaseRecommendedTokens || !hasSettledAccountRecommendedTokens),
    recommendedTokens,
    hasSettledBaseRecommendedTokens,
    hasSettledAccountRecommendedTokens,
    canUseAccountRecommendedTokens,
    accountKey,
    recommendedNetworkScopeKey,
  };
}

export function Recommended(
  props:
    | {
        disableHorizontalBleed?: boolean;
        recommendedItemContainerProps?: IYStackProps;
        withHeader?: boolean;
        enableFetch?: boolean;
      }
    | undefined,
) {
  const {
    disableHorizontalBleed = false,
    recommendedItemContainerProps,
    withHeader = true,
    enableFetch = true,
  } = props ?? {};

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const actions = useEarnActions();
  const [{ recommendedTokens: cachedRecommendedTokens = [] }] = useEarnAtom();
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [refreshVersion, setRefreshVersion] = useState(0);

  const refreshRecommended = useCallback(async () => {
    await backgroundApiProxy.serviceStaking.clearRecommendedAssetsCache();
    setRefreshVersion((prev) => prev + 1);
  }, []);

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

  const {
    recommendedTokens,
    isLoading,
    isBalanceLoading,
    hasSettledBaseRecommendedTokens,
    hasSettledAccountRecommendedTokens,
    canUseAccountRecommendedTokens,
    accountKey,
    recommendedNetworkScopeKey,
  } = useRecommendedTokens({
    accountId: account?.id,
    indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
    networkId: allNetworkId,
    enableFetch,
    refreshVersion,
    cachedRecommendedTokens,
    onBaseRecommendedTokensLoaded: handleBaseRecommendedTokensLoaded,
  });

  useRecommendedRefreshTrigger({
    accountId: account?.id,
    indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
    networkId: allNetworkId,
    recommendedTokens,
    enableFetch,
    onRefresh: refreshRecommended,
  });

  const noWalletConnected = !account && !indexedAccount;
  const recommendedLoadScopeKey = allNetworkId;
  const accountLoadScopeKey = `${accountKey}|${recommendedNetworkScopeKey}`;
  const hasCompletedInitialRecommendedLoadRef = useRef<string | undefined>(
    undefined,
  );
  const hasCompletedInitialBalanceLoadRef = useRef<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (enableFetch && hasSettledBaseRecommendedTokens) {
      hasCompletedInitialRecommendedLoadRef.current = recommendedLoadScopeKey;
    }
  }, [enableFetch, hasSettledBaseRecommendedTokens, recommendedLoadScopeKey]);

  useEffect(() => {
    if (
      enableFetch &&
      !noWalletConnected &&
      (hasSettledAccountRecommendedTokens || canUseAccountRecommendedTokens)
    ) {
      hasCompletedInitialBalanceLoadRef.current = accountLoadScopeKey;
    }
  }, [
    accountLoadScopeKey,
    canUseAccountRecommendedTokens,
    enableFetch,
    hasSettledAccountRecommendedTokens,
    noWalletConnected,
  ]);

  const showInitialSkeleton =
    isLoading === true &&
    recommendedTokens.length === 0 &&
    hasCompletedInitialRecommendedLoadRef.current !== recommendedLoadScopeKey;
  const showInitialBalanceSkeleton =
    isBalanceLoading &&
    hasCompletedInitialBalanceLoadRef.current !== accountLoadScopeKey;

  return (
    <RecommendedSection
      tokens={recommendedTokens}
      noWalletConnected={noWalletConnected}
      withHeader={withHeader}
      disableHorizontalBleed={disableHorizontalBleed}
      recommendedItemContainerProps={recommendedItemContainerProps}
      showSkeleton={showInitialSkeleton}
      isBalanceLoading={showInitialBalanceSkeleton}
    />
  );
}
