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
import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IEarnRewardsPortfolioStage } from '@onekeyhq/shared/types/staking';

import { NetworkFilterControl } from '../../../components/NetworkFilterControl';
import { PortfolioPendingTxsProvider } from '../../../components/PortfolioTabContent';
import { EarnNavigation } from '../../../earnUtils';
import { useEarnPortfolio } from '../../../hooks/useEarnPortfolio';
import { useHeaderHeightCacheKey } from '../../../hooks/useHeaderHeightCacheKey';
import { useNativeStackHeaderHeightEstimate } from '../../../hooks/useNativeStackHeaderHeightEstimate';
import { useSettledHeaderHeight } from '../../../hooks/useSettledHeaderHeight';
import {
  STAKING_TX_SETTLE_DELAY_MS,
  useStakingPendingTxsByInfo,
} from '../../../hooks/useStakingPendingTxs';

import { DeFiAssetsTab } from './DeFiAssetsTab';
import {
  countInvestmentsByNetwork,
  filterInvestmentsByNetworks,
  resolveDefiAssetsFiatValue,
  sumRewardsHeaderFiat,
} from './myPortfolio.utils';
import { PortfolioTotalsHeader } from './PortfolioTotalsHeader';
import { RewardsTab } from './RewardsTab';
import { UnderlineTabs } from './UnderlineTabs';
import { useRewardsPortfolio } from './useRewardsPortfolio';

import type { IPositionManageHandler } from './myPortfolio.utils';
import type { IStakePendingTx } from '../../../hooks/useStakingPendingTxs';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type IPrimaryTab = 'assets' | 'rewards';

/**
 * The phone "My portfolio" page (OK-61377, figma 29180-108096).
 *
 * Two sources, two tabs: the investment detail the wide layout already loads
 * (DeFi Assets, grouped per provider) and the ledger rewards endpoint
 * (Rewards, three stages). Every action lives on the protocol detail page —
 * the position card's Manage button is the way in; only Campaign / airdrop
 * rows keep an inline Claim, since some of them cannot reach a detail page.
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

  const portfolio = useEarnPortfolio({ isActive: isFocused });
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

  const refreshAll = useCallback(async () => {
    await Promise.all([portfolio.refresh(), refreshRewards()]);
  }, [portfolio, refreshRewards]);

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
    portfolio.investments.forEach((investment) => {
      const code = investment.protocol.providerDetail.code;
      investment.assets.forEach((asset) => {
        tagToProvider.set(
          buildLocalTxStatusSyncId({
            providerName: code,
            tokenSymbol: asset.token.info.symbol,
            protocolVault: asset.metadata.protocol.vault,
          }),
          code,
        );
      });
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
  }, [pendingTxs, portfolio.investments]);

  const networkAssetCounts = useMemo(
    () => countInvestmentsByNetwork(portfolio.investments),
    [portfolio.investments],
  );
  const availableNetworkIds = useMemo(
    () => Object.keys(networkAssetCounts),
    [networkAssetCounts],
  );
  const visibleInvestments = useMemo(
    () =>
      filterInvestmentsByNetworks(portfolio.investments, selectedNetworkIds),
    [portfolio.investments, selectedNetworkIds],
  );
  const defiAssetsFiatValue = useMemo(
    () =>
      resolveDefiAssetsFiatValue({
        hookTotal: portfolio.earnTotalFiatValue,
        investments: portfolio.investments,
      }),
    [portfolio.earnTotalFiatValue, portfolio.investments],
  );
  const rewardsHeaderFiat = useMemo(
    () =>
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: rewards?.totals.rewards,
        investments: portfolio.investments,
      }),
    [rewards?.totals.rewards, portfolio.investments],
  );

  // Manage opens the detail page, where every action lives; a tapped token
  // row opens its own, since one investment can span chains. Same guard as
  // the existing page: the Pendle USDe unstake row has no page to go to.
  const handleManage = useCallback<IPositionManageHandler>(
    (investment, asset = investment.assets[0]) => {
      if (!asset) {
        return;
      }
      const providerName = asset.metadata.protocol.providerDetail.code;
      if (
        earnUtils.isPendleProvider({ providerName }) &&
        asset.metadata.protocol.symbol === 'USDe' &&
        (!asset.buttons || asset.buttons.length === 0)
      ) {
        return;
      }
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId: asset.metadata.network.networkId,
        symbol: asset.token.info.symbol,
        provider: providerName,
        vault: asset.metadata.protocol.vault,
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
                defiAssetsFiatValue={defiAssetsFiatValue}
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
                  investments={visibleInvestments}
                  isLoading={portfolio.isLoading}
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
                  investments={visibleInvestments}
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
