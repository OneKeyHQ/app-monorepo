import { useCallback, useState } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useRecommendedRefreshTrigger } from '../hooks/useRecommendedRefreshTrigger';

import { RecommendedSection } from './RecommendedSection';

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
      return [];
    }

    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
        accountId: '',
        networkId,
      });

    return recommendedAssets?.tokens || [];
  }, [enableFetch, networkId]);

  const { result: baseRecommendedTokens = [], isLoading: isBaseLoading } =
    usePromiseResult<IRecommendAsset[]>(
      fetchBaseRecommendedTokens,
      [fetchBaseRecommendedTokens, refreshVersion],
      {
        initResult: [],
        watchLoading: true,
        overrideIsFocused: (isFocused) => isFocused && enableFetch,
      },
    );

  const shouldFetchAccountRecommendedTokens =
    enableFetch &&
    Boolean(accountId) &&
    (baseRecommendedTokens.length > 0 || isBaseLoading === false);

  const fetchAccountRecommendedTokens = useCallback(async () => {
    if (!shouldFetchAccountRecommendedTokens) {
      return [];
    }

    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
        accountId: accountId ?? '',
        networkId,
        indexedAccountId,
      });

    return recommendedAssets?.tokens || [];
  }, [
    accountId,
    indexedAccountId,
    networkId,
    shouldFetchAccountRecommendedTokens,
  ]);

  const { result: accountRecommendedTokens = [], isLoading: isAccountLoading } =
    usePromiseResult<IRecommendAsset[]>(
      fetchAccountRecommendedTokens,
      [fetchAccountRecommendedTokens, refreshVersion],
      {
        initResult: [],
        watchLoading: true,
        undefinedResultIfReRun: true,
        overrideIsFocused: (isFocused) =>
          isFocused && shouldFetchAccountRecommendedTokens,
      },
    );

  const recommendedTokens =
    accountRecommendedTokens.length > 0
      ? accountRecommendedTokens
      : baseRecommendedTokens;

  return {
    isLoading: isBaseLoading,
    isBalanceLoading:
      Boolean(accountId) &&
      baseRecommendedTokens.length > 0 &&
      accountRecommendedTokens.length === 0 &&
      isAccountLoading === true,
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
