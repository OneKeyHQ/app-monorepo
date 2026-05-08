import { useCallback, useMemo, useState } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
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
}: {
  accountId?: string;
  indexedAccountId?: string;
  networkId: string;
  enableFetch: boolean;
  refreshVersion: number;
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
      watchLoading: true,
      overrideIsFocused: (isFocused) => isFocused && enableFetch,
    },
  );

  const baseRecommendedTokens = baseRecommendedResult.tokens;
  const hasSettledBaseRecommendedTokens =
    baseRecommendedResult.refreshVersion === refreshVersion &&
    isBaseLoading === false;
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
      watchLoading: true,
      undefinedResultIfReRun: true,
      overrideIsFocused: (isFocused) =>
        isFocused && shouldFetchAccountRecommendedTokens,
    },
  );

  const hasSettledAccountRecommendedTokens =
    shouldFetchAccountRecommendedTokens &&
    accountRecommendedResult.refreshVersion === refreshVersion &&
    accountRecommendedResult.scopeNetworkKey === recommendedNetworkScopeKey &&
    accountRecommendedResult.accountKey === accountKey &&
    isAccountLoading === false;
  const accountRecommendedTokens = accountRecommendedResult.tokens;
  const canUseAccountRecommendedTokens =
    hasSettledAccountRecommendedTokens && accountRecommendedTokens.length > 0;
  const recommendedTokens = canUseAccountRecommendedTokens
    ? accountRecommendedTokens
    : baseRecommendedTokens;

  return {
    isLoading: isBaseLoading,
    isBalanceLoading:
      Boolean(accountId) &&
      baseRecommendedTokens.length > 0 &&
      (!hasSettledBaseRecommendedTokens ||
        (shouldFetchAccountRecommendedTokens &&
          !hasSettledAccountRecommendedTokens)),
    recommendedTokens,
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
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [refreshVersion, setRefreshVersion] = useState(0);

  const refreshRecommended = useCallback(async () => {
    await backgroundApiProxy.serviceStaking.clearRecommendedAssetsCache();
    setRefreshVersion((prev) => prev + 1);
  }, []);

  const { recommendedTokens, isLoading, isBalanceLoading } =
    useRecommendedTokens({
      accountId: account?.id,
      indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
      networkId: allNetworkId,
      enableFetch,
      refreshVersion,
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

  return (
    <RecommendedSection
      tokens={recommendedTokens}
      noWalletConnected={noWalletConnected}
      withHeader={withHeader}
      disableHorizontalBleed={disableHorizontalBleed}
      recommendedItemContainerProps={recommendedItemContainerProps}
      showSkeleton={
        isLoading === true ? recommendedTokens.length === 0 : undefined
      }
      isBalanceLoading={isBalanceLoading}
    />
  );
}
