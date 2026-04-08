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
  const fetchRecommendedTokens = useCallback(async () => {
    if (!enableFetch) {
      return [];
    }

    const recommendedAssets =
      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
        accountId: accountId ?? '',
        networkId,
        indexedAccountId,
      });

    return recommendedAssets?.tokens || [];
  }, [accountId, enableFetch, indexedAccountId, networkId]);

  const { result: recommendedTokens = [], isLoading } = usePromiseResult<
    IRecommendAsset[]
  >(fetchRecommendedTokens, [fetchRecommendedTokens, refreshVersion], {
    initResult: [],
    watchLoading: true,
    overrideIsFocused: (isFocused) => isFocused && enableFetch,
  });

  return {
    isLoading,
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

  const { recommendedTokens, isLoading } = useRecommendedTokens({
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
    />
  );
}
