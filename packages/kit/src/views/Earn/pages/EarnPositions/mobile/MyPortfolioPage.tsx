import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Page,
  RefreshControl,
  ScrollView,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { BorrowNavigation } from '@onekeyhq/kit/src/views/Borrow/borrowUtils';
import { useBorrowMarkets } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowMarkets';
import { warmWithdrawWaysOut } from '@onekeyhq/kit/src/views/Staking/components/UniversalWithdraw/warmWithdrawWaysOut';
import {
  buildEarnProtocolInfo,
  buildEarnTokenInfo,
} from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { IEarnPositionManageTarget } from '@onekeyhq/shared/types/earn/portfolioPositions';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowMarketItem,
  IEarnRewardsPortfolioStage,
} from '@onekeyhq/shared/types/staking';

import { useEarnDesktopAccountMarkets } from '../../../components/desktopHome/useEarnDesktopHomeData';
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
import { DeFiAssetsDesktopTab } from '../desktop/DeFiAssetsDesktopTab';

import { DeFiAssetsTab } from './DeFiAssetsTab';
import { withLendingMarketPositions } from './earnLendingPositions';
import { EMPTY_POSITIONS_RESPONSE } from './earnPortfolioPositions.utils';
import {
  buildEarnClaimableRewardGroups,
  buildEarnPendingRewardGroups,
  buildEarnPortfolioView,
  countEarnPositionsByNetwork,
  filterEarnProtocolsByNetworks,
  sumEarnClaimableRewards,
  sumEarnPendingRewards,
} from './earnPositionModel';
import {
  findLoanMarketOf,
  positionPendingTag,
  sumRewardsHeaderFiat,
} from './myPortfolio.utils';
import { PortfolioTableLayoutContext } from './portfolioTableLayout';
import { PortfolioTotalsHeader } from './PortfolioTotalsHeader';
import { RewardsTab } from './RewardsTab';
import { UnderlineTabs } from './UnderlineTabs';
import { useEarnPortfolioPositions } from './useEarnPortfolioPositions';
import { useRewardsPortfolio } from './useRewardsPortfolio';

import type { IRefreshOptions } from '../../../hooks/useEarnPortfolio';
import type { IStakePendingTx } from '../../../hooks/useStakingPendingTxs';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type IPrimaryTab = 'assets' | 'rewards';

// One stable empty selection: the rewards request keys on the array.
const ALL_NETWORKS: string[] = [];
const NO_MARKETS: IBorrowMarketItem[] = [];
// The lending markets the positions API leaves out (Aave, Kamino) are read
// here as the DeFi home reads them for its Net Worth, so the two totals
// agree (web; the phone app keeps the API's list)
const READS_LENDING_MARKETS = !platformEnv.isNative;
// The wide layout's column, the wallet DeFi Portfolio's desktop width
const TABLE_LAYOUT_MAX_WIDTH = 1140;

/**
 * The phone "My portfolio" page (OK-61377, figma 29180-108096).
 *
 * Two sources, two tabs: the positions endpoint (DeFi Assets, one card per
 * position under one row per protocol per network, the wallet DeFi
 * Portfolio contract) and the ledger rewards endpoint (Rewards, three
 * stages). A card is the detail page's Balance and Rewards (product 10-14):
 * its rows redeem, claim, check and cancel right here, and its header line
 * opens the detail page.
 *
 * Deliberately not here, per product: the hide-small-assets switch (the
 * shared setting still exists for the wide layout; this page never applies
 * it) and the asset status rows (the detail page carries them).
 */
export function MyPortfolioPage({
  tableLayout = false,
  focusRequest,
}: {
  /** The wide layout scrolls to these protocols' cards (the home's split) */
  focusRequest?: { protocols: string[]; at: number };
  /**
   * The wide layout (media.gtMd), the way the wallet DeFi Portfolio lays
   * out on desktop: a centered column, the network filter on the tab row,
   * the allocation overview and open protocol cards with their holdings as
   * tables. The data, the actions and the phone layout stay as they are.
   */
  tableLayout?: boolean;
} = {}) {
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
  // On web a tab once shown stays mounted and hides while the other shows,
  // so coming back to DeFi Assets costs a display change instead of building
  // its cards again. The apps keep mounting the selected tab only
  const [shownTabs, setShownTabs] = useState<IPrimaryTab[]>([primaryTab]);
  if (!shownTabs.includes(primaryTab)) {
    setShownTabs([...shownTabs, primaryTab]);
  }
  const isTabMounted = (tab: IPrimaryTab) =>
    tab === primaryTab || (!platformEnv.isNative && shownTabs.includes(tab));
  const tabDisplay = (tab: IPrimaryTab) =>
    tab === primaryTab ? 'flex' : 'none';
  // The tab picked shows clear for a frame, then fades in over 150 ms
  const reduceMotion = useReducedMotion();
  const [enteringTab, setEnteringTab] = useState<IPrimaryTab | undefined>();
  useEffect(() => {
    if (!enteringTab) {
      return undefined;
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEnteringTab(undefined));
    });
    return () => cancelAnimationFrame(frame);
  }, [enteringTab]);
  const handleTabChange = (tab: IPrimaryTab) => {
    if (tab === primaryTab) {
      return;
    }
    setPrimaryTab(tab);
    if (!reduceMotion) {
      setEnteringTab(tab);
    }
  };
  const tabMotion = (tab: IPrimaryTab) =>
    reduceMotion
      ? undefined
      : ({
          opacity: tab === enteringTab ? 0 : 1,
          transition: 'quick',
          animateOnly: ANIMATE_ONLY_OPACITY,
        } as const);
  const [stage, setStage] = useState<IEarnRewardsPortfolioStage>('claimable');
  // The network filter belongs to the account it was picked on (OK-64596):
  // another account opens on All networks, in the same render, instead of
  // keeping a network it may hold nothing on. The account is the indexed
  // account when there is one, so changing the wallet's network alone keeps
  // the filter.
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const filterAccountKey =
    activeAccount.account?.indexedAccountId ||
    activeAccount.indexedAccount?.id ||
    activeAccount.account?.id ||
    '';
  const [networkSelection, setNetworkSelection] = useState<{
    accountKey: string;
    networkIds: string[];
  }>({ accountKey: '', networkIds: ALL_NETWORKS });
  const selectedNetworkIds =
    networkSelection.accountKey === filterAccountKey
      ? networkSelection.networkIds
      : ALL_NETWORKS;
  const setSelectedNetworkIds = useCallback(
    (networkIds: string[]) =>
      setNetworkSelection({ accountKey: filterAccountKey, networkIds }),
    [filterAccountKey],
  );

  const {
    response: loadedResponse,
    isLoading: isPositionsLoading,
    refresh: refreshPositions,
  } = useEarnPortfolioPositions({ isActive: isFocused });
  // The account's positions in the lending markets, each market's answer as
  // the home last had it until this page's own lands
  const { markets: borrowMarkets, isLoading: isBorrowMarketListLoading } =
    useBorrowMarkets({ isActive: isFocused && READS_LENDING_MARKETS });
  const lendingMarketList = READS_LENDING_MARKETS
    ? (borrowMarkets ?? NO_MARKETS)
    : NO_MARKETS;
  const lendingMarkets = useEarnDesktopAccountMarkets({
    markets: lendingMarketList,
    isListReady: lendingMarketList.length > 0 || !isBorrowMarketListLoading,
    isActive: isFocused && READS_LENDING_MARKETS,
  });
  // Partial sums are wrong numbers: a first load, the only kind that starts
  // from an empty page, keeps the page empty until every protocol has
  // answered, the lending markets too, and then shows it whole, as the DeFi
  // home's Net Worth does. Shown as each one landed, the totals counted up
  // from $0.00 and the bar, tiles and cards reordered several times in a
  // second. A refresh keeps the rows on screen as before
  const isFirstLoad =
    isPositionsLoading || (READS_LENDING_MARKETS && !lendingMarkets.isLoaded);
  const response = useMemo(() => {
    if (isFirstLoad) {
      return EMPTY_POSITIONS_RESPONSE;
    }
    return READS_LENDING_MARKETS
      ? withLendingMarketPositions({
          response: loadedResponse,
          entries: lendingMarkets.entries,
        })
      : loadedResponse;
  }, [isFirstLoad, lendingMarkets.entries, loadedResponse]);
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

  const refreshLendingMarkets = lendingMarkets.refresh;
  const refreshAll = useCallback(
    async (options?: IRefreshOptions) => {
      await Promise.all([
        refreshPositions(options),
        refreshRewards(),
        READS_LENDING_MARKETS ? refreshLendingMarkets() : undefined,
      ]);
    },
    [refreshLendingMarkets, refreshPositions, refreshRewards],
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
  // The chip offers every network the wallet holds on or has ledger rewards
  // on: a network with rewards but no position would otherwise never be
  // selectable. The ledger's networks accumulate as its reads land (a read
  // under a filter lists the filtered networks only) and start over with
  // the account.
  const [ledgerNetworkIds, setLedgerNetworkIds] = useState<string[]>([]);
  useEffect(() => {
    setLedgerNetworkIds([]);
  }, [filterAccountKey]);
  useEffect(() => {
    if (!rewards) {
      return;
    }
    setLedgerNetworkIds((prev) => {
      const next = new Set(prev);
      rewards.groups.forEach((group) => next.add(group.networkId));
      return next.size === prev.length ? prev : Array.from(next);
    });
  }, [rewards]);
  const availableNetworkIds = useMemo(
    () =>
      Array.from(
        new Set([...Object.keys(networkAssetCounts), ...ledgerNetworkIds]),
      ),
    [networkAssetCounts, ledgerNetworkIds],
  );
  const visibleProtocols = useMemo(
    () => filterEarnProtocolsByNetworks(view.protocols, selectedNetworkIds),
    [view.protocols, selectedNetworkIds],
  );
  const claimableGroups = useMemo(
    () => buildEarnClaimableRewardGroups(visibleProtocols),
    [visibleProtocols],
  );
  const pendingGroups = useMemo(
    () => buildEarnPendingRewardGroups(visibleProtocols),
    [visibleProtocols],
  );
  // Product rule: the header Rewards figure equals what the Claimable and
  // Pending lists add up to, filter aside — the ledger totals are over every
  // network, so the protocol part is summed over every protocol too.
  const rewardsHeaderFiat = useMemo(
    () =>
      sumRewardsHeaderFiat({
        ledgerRewardsFiatValue: rewards?.totals.rewards,
        positionRewardsValue:
          sumEarnClaimableRewards(view.protocols) +
          sumEarnPendingRewards(view.protocols),
      }),
    [rewards?.totals.rewards, view.protocols],
  );

  // The card's header line opens the position's own detail page, landing on
  // its Portfolio tab. On web a loan opens its market's Borrow page instead,
  // where repaying and the collateral are (demo 10-28)
  const handleManage = useCallback(
    (target: IEarnPositionManageTarget) => {
      const loanMarket = platformEnv.isNative
        ? undefined
        : findLoanMarketOf(view.protocols, target);
      if (loanMarket) {
        BorrowNavigation.pushToBorrowHome(navigation, loanMarket);
        return;
      }
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        ...target,
        scrollToPortfolio: true,
      });
    },
    [navigation, view.protocols],
  );

  // The account the page is on, read after an await: a Redeem whose read
  // outlived an account switch opens nothing of the account it left.
  const filterAccountKeyRef = useRef(filterAccountKey);
  filterAccountKeyRef.current = filterAccountKey;

  // A card's Redeem opens the withdrawal the detail page's Redeem opens.
  // Most providers take an amount on the manage page's withdraw tab. A
  // provider that withdraws an order (Stakefish SOL/ETH, Everstake SOL,
  // Babylon) picks it on WithdrawOptions, whose pages read the detail, so
  // the detail is fetched first while the button waits (OK-64782); should
  // that read fail, or leave the picker without the token it lists orders
  // by, the manage page opens and hands off to the picker itself. The
  // card's provider refreshes once the withdrawal is sent.
  const handleRedeem = useCallback(
    async (
      target: IEarnPositionManageTarget,
      { byOrder }: { byOrder: boolean },
    ) => {
      const onSuccess = () => {
        void refreshAll({ provider: target.provider });
      };
      const openManagePage = () =>
        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ManagePosition,
          params: {
            networkId: target.networkId,
            symbol: target.symbol,
            provider: target.provider,
            vault: target.vault,
            tab: 'withdraw',
            onStakeWithdrawSuccess: onSuccess,
          },
        });
      if (!byOrder) {
        openManagePage();
        return;
      }
      // The account the way the detail page resolves it: an imported or
      // watched wallet's own account, else the indexed account.
      const accountId = selectedAccount.othersWalletAccountId || '';
      const indexedAccountId =
        selectedAccount.indexedAccountId || activeAccount.indexedAccount?.id;
      const accountKeyAtPress = filterAccountKeyRef.current;
      try {
        const [detailInfo, earnAccount] = await Promise.all([
          backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
            accountId,
            indexedAccountId,
            networkId: target.networkId,
            symbol: target.symbol,
            provider: target.provider,
            vault: target.vault,
          }),
          backgroundApiProxy.serviceStaking.getEarnAccount({
            accountId,
            networkId: target.networkId,
            indexedAccountId,
            btcOnlyTaproot: true,
          }),
        ]);
        if (filterAccountKeyRef.current !== accountKeyAtPress) {
          return;
        }
        const vault = detailInfo.protocol?.vault ?? target.vault;
        const protocolInfo = earnAccount
          ? buildEarnProtocolInfo({
              detailInfo,
              earnAccount,
              provider: target.provider,
              symbol: target.symbol,
              vault,
            })
          : undefined;
        const tokenInfo = buildEarnTokenInfo({
          detailInfo,
          networkId: target.networkId,
          provider: target.provider,
          vault,
          accountId: earnAccount?.accountId ?? '',
        });
        if (!earnAccount || !protocolInfo || !tokenInfo) {
          openManagePage();
          return;
        }
        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.WithdrawOptions,
          params: {
            accountId: earnAccount.accountId,
            networkId: target.networkId,
            protocolInfo,
            tokenInfo,
            symbol: target.symbol,
            provider: target.provider,
            onSuccess,
          },
        });
      } catch {
        if (filterAccountKeyRef.current === accountKeyAtPress) {
          openManagePage();
        }
      }
    },
    [
      navigation,
      refreshAll,
      selectedAccount.othersWalletAccountId,
      selectedAccount.indexedAccountId,
      activeAccount.indexedAccount?.id,
    ],
  );

  // Pointed at or focused, a row's Redeem reads its withdraw form's ways out
  // ahead, once per row on this page, for the account the press would use
  const warmedRedeemsRef = useRef(new Set<string>());
  const handleWarmRedeem = useCallback(
    (target: IEarnPositionManageTarget, inputTokenAddress: string) => {
      const key = [
        filterAccountKeyRef.current,
        target.networkId,
        target.provider,
        target.symbol,
        target.vault ?? '',
        inputTokenAddress,
      ].join('|');
      if (warmedRedeemsRef.current.has(key)) {
        return;
      }
      warmedRedeemsRef.current.add(key);
      void (async () => {
        const earnAccount =
          await backgroundApiProxy.serviceStaking.getEarnAccount({
            accountId: selectedAccount.othersWalletAccountId || '',
            networkId: target.networkId,
            indexedAccountId:
              selectedAccount.indexedAccountId ||
              activeAccount.indexedAccount?.id,
            btcOnlyTaproot: true,
          });
        if (!earnAccount) {
          return;
        }
        await warmWithdrawWaysOut({
          accountId: earnAccount.accountId,
          networkId: target.networkId,
          providerName: target.provider,
          symbol: target.symbol,
          vault: target.vault,
          inputTokenAddress,
        });
      })().catch(() => undefined);
    },
    [
      selectedAccount.othersWalletAccountId,
      selectedAccount.indexedAccountId,
      activeAccount.indexedAccount?.id,
    ],
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
      variant={tableLayout ? 'pill' : 'compact'}
    />
  );
  const tabs = (
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
      onChange={handleTabChange}
      testID="earn-my-portfolio-tabs"
      bare={tableLayout}
    />
  );
  // The wallet protocols behind the cards the filter leaves, for the overview
  const visibleDeFiProtocols = useMemo(() => {
    const keys = new Set(visibleProtocols.map((protocol) => protocol.key));
    return view.deFiProtocols.filter((protocol) =>
      keys.has(
        defiUtils.buildProtocolMapKey({
          protocol: protocol.protocol,
          networkId: protocol.networkId,
        }),
      ),
    );
  }, [view.deFiProtocols, visibleProtocols]);

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
            <PortfolioTableLayoutContext.Provider value={tableLayout}>
              <YStack
                {...(tableLayout
                  ? {
                      width: '100%',
                      maxWidth: TABLE_LAYOUT_MAX_WIDTH,
                      alignSelf: 'center',
                      py: '$6',
                    }
                  : { py: '$2' })}
              >
                {/* DeFi Assets leaves the positions' rewards out; Rewards counts them */}
                <PortfolioTotalsHeader
                  defiAssetsFiatValue={String(view.totalValue)}
                  rewardsFiatValue={rewardsHeaderFiat}
                  isLoading={isFirstLoad}
                />
                {tableLayout ? (
                  // One row for the tabs and the filter both tabs share
                  <XStack
                    mx="$5"
                    mb="$5"
                    ai="center"
                    jc="space-between"
                    gap="$4"
                    borderBottomWidth="$px"
                    borderBottomColor="$borderSubdued"
                  >
                    {tabs}
                    {networkFilter}
                  </XStack>
                ) : (
                  tabs
                )}
                {isTabMounted('assets') ? (
                  <YStack
                    display={tabDisplay('assets')}
                    {...tabMotion('assets')}
                  >
                    {tableLayout ? (
                      <DeFiAssetsDesktopTab
                        focusRequest={focusRequest}
                        protocols={visibleProtocols}
                        deFiProtocols={visibleDeFiProtocols}
                        protocolMap={view.protocolMap}
                        isLoading={isFirstLoad}
                        pendingCountByProvider={pendingCountByProvider}
                        onManage={handleManage}
                        onRedeem={handleRedeem}
                        onWarmRedeem={handleWarmRedeem}
                      />
                    ) : (
                      <DeFiAssetsTab
                        protocols={visibleProtocols}
                        isLoading={isFirstLoad}
                        pendingCountByProvider={pendingCountByProvider}
                        networkFilter={networkFilter}
                        onManage={handleManage}
                        onRedeem={handleRedeem}
                        onWarmRedeem={handleWarmRedeem}
                      />
                    )}
                  </YStack>
                ) : null}
                {isTabMounted('rewards') ? (
                  <YStack
                    display={tabDisplay('rewards')}
                    {...tabMotion('rewards')}
                  >
                    <RewardsTab
                      stage={stage}
                      onStageChange={setStage}
                      rewards={rewards}
                      isLoading={isRewardsLoading}
                      isLoadingMore={isRewardsLoadingMore}
                      claimableGroups={claimableGroups}
                      pendingGroups={pendingGroups}
                      positions={positions}
                      networkFilter={tableLayout ? null : networkFilter}
                      onManage={handleManage}
                    />
                  </YStack>
                ) : null}
              </YStack>
            </PortfolioTableLayoutContext.Provider>
          </PortfolioPendingTxsProvider>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
