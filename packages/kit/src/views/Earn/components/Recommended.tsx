import { useCallback, useMemo } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { buildLocalTxStatusSyncId } from '../../Staking/utils/utils';
import { useStakingPendingTxsByInfo } from '../hooks/useStakingPendingTxs';

import { RecommendedSection } from './RecommendedSection';

const RECOMMENDED_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
});

function useRecommendedTokens({
  accountId,
  indexedAccountId,
  networkId,
  enableFetch,
  refreshTrigger,
}: {
  accountId?: string;
  indexedAccountId?: string;
  networkId: string;
  enableFetch: boolean;
  refreshTrigger?: number;
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

  const {
    result: recommendedTokens = [],
    isLoading,
    run: refreshRecommendedTokens,
  } = usePromiseResult<IRecommendAsset[]>(
    fetchRecommendedTokens,
    [fetchRecommendedTokens, refreshTrigger],
    {
      initResult: [],
      watchLoading: true,
      overrideIsFocused: (isFocused) => isFocused && enableFetch,
    },
  );

  const recommendedNetworkIds = useMemo(
    () =>
      Array.from(
        new Set(
          recommendedTokens.flatMap((token) =>
            (token.protocols ?? [])
              .map((protocol) => protocol.networkId)
              .filter((protocolNetworkId): protocolNetworkId is string =>
                Boolean(protocolNetworkId),
              ),
          ),
        ),
      ),
    [recommendedTokens],
  );

  const recommendedStakeTags = useMemo(() => {
    const tags = new Set<string>();

    recommendedTokens.forEach((token) => {
      token.protocols?.forEach(({ provider }) => {
        if (!provider || !token.symbol) {
          return;
        }

        tags.add(
          buildLocalTxStatusSyncId({
            providerName: provider,
            tokenSymbol: token.symbol,
          }),
        );
      });
    });

    return tags;
  }, [recommendedTokens]);

  const tagMatcher = useCallback(
    (tag: string) => recommendedStakeTags.has(tag),
    [recommendedStakeTags],
  );

  const handleRecommendedRefresh = useCallback(async () => {
    await backgroundApiProxy.serviceStaking.clearRecommendedAssetsCache();
    await refreshRecommendedTokens();
  }, [refreshRecommendedTokens]);

  useStakingPendingTxsByInfo({
    networkIds: enableFetch ? recommendedNetworkIds : [],
    tagMatcher,
    onRefresh: enableFetch ? handleRecommendedRefresh : undefined,
    onRefreshDelayMs: RECOMMENDED_REFRESH_DELAY,
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
        refreshTrigger?: number;
      }
    | undefined,
) {
  const {
    disableHorizontalBleed = false,
    recommendedItemContainerProps,
    withHeader = true,
    enableFetch = true,
    refreshTrigger,
  } = props ?? {};

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const { recommendedTokens, isLoading } = useRecommendedTokens({
    accountId: account?.id,
    indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
    networkId: allNetworkId,
    enableFetch,
    refreshTrigger,
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
