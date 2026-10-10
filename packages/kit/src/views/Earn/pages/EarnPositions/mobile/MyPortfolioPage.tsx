import { useCallback, useMemo, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Page,
  RefreshControl,
  ScrollView,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPositionManageTarget } from '@onekeyhq/shared/types/earn/portfolioPositions';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IEarnRewardsPortfolioStage } from '@onekeyhq/shared/types/staking';

import { NetworkFilterControl } from '../../../components/NetworkFilterControl';
import { PortfolioPendingTxsProvider } from '../../../components/PortfolioTabContent';
import { EarnNavigation } from '../../../earnUtils';
import { useHeaderHeightCacheKey } from '../../../hooks/useHeaderHeightCacheKey';
import { useNativeStackHeaderHeightEstimate } from '../../../hooks/useNativeStackHeaderHeightEstimate';
import { useSettledHeaderHeight } from '../../../hooks/useSettledHeaderHeight';
import {
  STAKING_TX_SETTLE_DELAY_MS,
  useStakingPendingTxsByInfo,
} from '../../../hooks/useStakingPendingTxs';

import { DeFiAssetsTab } from './DeFiAssetsTab';
import {
  buildEarnClaimableRewardsView,
  buildEarnPortfolioView,
  countEarnPositionsByNetwork,
  filterEarnProtocolsByNetworks,
  sumEarnClaimableRewards,
} from './earnPositionModel';
import { positionPendingTag, sumRewardsHeaderFiat } from './myPortfolio.utils';
import { PortfolioTotalsHeader } from './PortfolioTotalsHeader';
import { RewardsTab } from './RewardsTab';
import { UnderlineTabs } from './UnderlineTabs';
import { useEarnPortfolioPositions } from './useEarnPortfolioPositions';
import { useRewardsPortfolio } from './useRewardsPortfolio';

import type { IRefreshOptions } from '../../../hooks/useEarnPortfolio';
import type { IStakePendingTx } from '../../../hooks/useStakingPendingTxs';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type IPrimaryTab = 'assets' | 'rewards';

/**
 * The phone "My portfolio" page (OK-61377, figma 29180-108096).
 *
 * Two sources, two tabs: the positions endpoint (DeFi Assets, one card per
 * position under one row per protocol per network, the wallet DeFi
 * Portfolio contract) and the ledger rewards endpoint (Rewards, three
 * stages). Every action lives on the protocol detail page — the card's
 * Manage button is the way in — except the claims the server attaches to a
 * row (withdrawn principal, ledger campaigns), which run right here.
 *
 * Deliberately not here, per product: the hide-small-assets switch (the
 * shared setting still exists for the wide layout; this page never applies
 * it) and the asset status rows (the detail page carries them).
 */
export function MyPortfolioPage() {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const navigation = useAppNavigation();
  const headerHeight = useHeaderHeight();
  const headerHeightCacheKey = useHeaderHeightCacheKey();
  const estimatedHeaderHeight = useNativeStackHeaderHeightEstimate();
  const tabBarHeight = useScrollContentTabBarOffset();
  // Same inset ownership as the existing page (OK-59958): the settled height
  // is remembered per device so the body is never hidden a second time.
  const { paddingTop: bodyPaddingTop, isSettled: isHeaderHeightSettled } =
    useSettledHeaderHeight(headerHeight, {
      cacheKey: headerHeightCacheKey,
      estimatedHeaderHeight,
    });

  const [primaryTab, setPrimaryTab] = useState<IPrimaryTab>('assets');
  const [stage, setStage] = useState<IEarnRewardsPortfolioStage>('claimable');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);

  const {
    response,
    isLoading: isPositionsLoading,
    refresh: refreshPositions,
  } = useEarnPortfolioPositions({ isActive: isFocused });
  const {
    rewards,
    isLoading: isRewardsLoading,
    isLoadingMore: isRewardsLoadingMore,
    hasMore: hasMoreRewards,
    loadMore: loadMoreRewards,
    refresh: refreshRewards,
  } = useRewardsPortfolio({
    stage,
    networkIds: selectedNetworkIds,
    isActive: isFocused,
  });

  const refreshAll = useCallback(
    async (options?: IRefreshOptions) => {
      await Promise.all([refreshPositions(options), refreshRewards()]);
    },
    [refreshPositions, refreshRewards],
  );

  const translate = useCallback(
    (id: ETranslations) => intl.formatMessage({ id }),
    [intl],
  );
  const view = useMemo(
    () => buildEarnPortfolioView({ response, translate }),
    [response, translate],
  );
  const positions = useMemo(
    () => Object.values(response.positions).flat(),
    [response],
  );

  // In-flight badge per provider, and the refresh once those settle — the
  // detail page's settle delay, so a refresh never caches the pre-tx balance.
  const pendingTxsFilter = useCallback(
    (tx: IStakePendingTx) =>
      [
        EEarnLabels.Stake,
        EEarnLabels.Withdraw,
        EEarnLabels.Sell,
        EEarnLabels.Claim,
      ].includes(tx.stakingInfo.label),
    [],
  );
  const { filteredTxs: pendingTxs = [] } = useStakingPendingTxsByInfo({
    filter: pendingTxsFilter,
    onRefresh: refreshAll,
    onRefreshDelayMs: STAKING_TX_SETTLE_DELAY_MS,
  });
  const pendingCountByProvider = useMemo(() => {
    const tagToProvider = new Map<string, string>();
    positions.forEach((position) => {
      tagToProvider.set(positionPendingTag(position), position.protocol);
    });
    const counts: Record<string, number> = {};
    pendingTxs.forEach((tx) => {
      const provider = tx.stakingInfo.tags
        ?.map((tag) => tagToProvider.get(tag))
        .find(Boolean);
      if (provider) {
        counts[provider] = (counts[provider] ?? 0) + 1;
      }
    });
    return counts;
  }, [pendingTxs, positions]);

  const networkAssetCounts = useMemo(
    () => countEarnPositionsByNetwork(view.protocols),
    [view.protocols],
  );
  const availableNetworkIds = useMemo(
    () => Object.keys(networkAssetCounts),
    [networkAssetCounts],
  );
  const visibleProtocols = useMemo(
    () => filterEarnProtocolsByNetworks(view.protocols, selectedNetworkIds),
    [view.protocols, selectedNetworkIds],
  );
  const claimableProtocols = useMemo(
    () => buildEarnClaimableRewardsView(visibleProtocols),
    [visibleProtocols],
  );
  // Product rule: the header Rewards figure equals what the Claimable and
  // Pending lists add up to, filter aside — the ledger totals are over every
  // network, so the protocol part is summed over every protocol too.
  const rewardsHeaderFiat = useMemo(
    () =>
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: rewards?.totals.rewards,
        positionRewardsValue: sumEarnClaimableRewards(view.protocols),
      }),
    [rewards?.totals.rewards, view.protocols],
  );

  // Manage and a tapped row open the position's own detail page, where every
  // other action lives, landing on its Portfolio tab.
  const handleManage = useCallback(
    (target: IEarnPositionManageTarget) => {
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        ...target,
        scrollToPortfolio: true,
      });
    },
    [navigation],
  );

  // Ledger paging: the next page loads as the Rewards tab nears the bottom
  // (same threshold as the referral reward pages). Only the ledger pages;
  // DeFi Assets holds every position already.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (primaryTab !== 'rewards' || !hasMoreRewards || isRewardsLoadingMore) {
        return;
      }
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const isCloseToBottom =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
      if (isCloseToBottom) {
        void loadMoreRewards();
      }
    },
    [primaryTab, hasMoreRewards, isRewardsLoadingMore, loadMoreRewards],
  );

  // One chip, placed by each tab: under the tabs on DeFi Assets, under the
  // stage pills on Rewards (figma 29180-108096 / 29180-109152).
  const networkFilter = (
    <NetworkFilterControl
      availableNetworkIds={availableNetworkIds}
      selectedNetworkIds={selectedNetworkIds}
      networkAssetCounts={networkAssetCounts}
      onSelectionChange={setSelectedNetworkIds}
      variant="compact"
    />
  );

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refreshAll]);

  return (
    <Page>
      {/* No history icon (product): history stays on each protocol's detail
          page and payouts live under Rewards > Distributed; an account-wide
          DeFi history is a separate requirement. */}
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.earn_my_portfolio__title,
        })}
      />
      <Page.Body pt={bodyPaddingTop} opacity={isHeaderHeightSettled ? 1 : 0}>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarHeight }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <PortfolioPendingTxsProvider value={{ onRefresh: refreshAll }}>
            <YStack py="$2">
              <PortfolioTotalsHeader
                defiAssetsFiatValue={String(view.totalValue)}
                rewardsFiatValue={rewardsHeaderFiat}
              />
              <UnderlineTabs<IPrimaryTab>
                tabs={[
                  {
                    key: 'assets',
                    label: intl.formatMessage({
                      id: ETranslations.earn_defi_assets__title,
                    }),
                  },
                  {
                    key: 'rewards',
                    label: intl.formatMessage({
                      id: ETranslations.earn_rewards,
                    }),
                  },
                ]}
                value={primaryTab}
                onChange={setPrimaryTab}
                testID="earn-my-portfolio-tabs"
              />
              {primaryTab === 'assets' ? (
                <DeFiAssetsTab
                  protocols={visibleProtocols}
                  isLoading={isPositionsLoading}
                  pendingCountByProvider={pendingCountByProvider}
                  networkFilter={networkFilter}
                  onManage={handleManage}
                />
              ) : (
                <RewardsTab
                  stage={stage}
                  onStageChange={setStage}
                  rewards={rewards}
                  isLoading={isRewardsLoading}
                  isLoadingMore={isRewardsLoadingMore}
                  claimableProtocols={claimableProtocols}
                  positions={positions}
                  networkFilter={networkFilter}
                  onManage={handleManage}
                />
              )}
            </YStack>
          </PortfolioPendingTxsProvider>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
