import { useCallback, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  DelayedFreeze,
  Skeleton,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IAppPagerTabBarProps } from '@onekeyhq/kit/src/components/AppPager/types';
import { useTabContainerWidth } from '@onekeyhq/kit/src/hooks/useTabContainerWidth';
import { isHoldersTabSupported } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { useStockDetail } from '../../../hooks/StockDetailContext';
import { useMarketDetailPositionTab } from '../../../hooks/useMarketDetailPositionTab';
import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { TokenLiquidityPools } from '../../TokenLiquidityPools';
import { Holders } from '../components/Holders';
import { Portfolio } from '../components/Portfolio';
import {
  TransactionsHistory,
  TransactionsSkeleton,
} from '../components/TransactionsHistory';
import { useBottomTabAnalytics } from '../hooks/useBottomTabAnalytics';
import { useNetworkAccountAddress } from '../hooks/useNetworkAccountAddress';

import { MarketDetailPager } from './MarketDetailPager';
import {
  MarketDetailHeaderGesture,
  MarketDetailScrollView,
} from './MarketDetailScroll';
import {
  MobileStockFinancialsPanel,
  MobileStockOverviewPanel,
  MobileTopCoinsOverviewPanel,
  MobileTrendingOverviewPanel,
} from './MobileDetailOverviewPanels';
import { StickyHeader } from './StickyHeader';

import type { IMarketMobileDetailKind } from '../../../utils/marketMobileDetailKind';

function MobileInformationTabsHeader({
  holdersTabLabel,
  holdersTabName,
  detailKind,
  ...props
}: IAppPagerTabBarProps & {
  holdersTabLabel: string;
  holdersTabName: string;
  detailKind: IMarketMobileDetailKind;
}) {
  const { focusedTab, onTabPress } = props;

  const handleTabPress = useCallback(
    (tabName: string) => {
      // Prevent default "press active tab to collapse header" behavior.
      if (tabName === focusedTab.value) {
        return;
      }
      onTabPress?.(tabName);
    },
    [focusedTab, onTabPress],
  );
  const renderTabBarItem = useCallback(
    (
      itemProps: React.ComponentProps<typeof Tabs.TabBarItem>,
      index: number,
    ) => (
      <Tabs.TabBarItem
        key={itemProps.name}
        {...itemProps}
        testID={`market-detail-information-tab-${index}`}
        label={
          itemProps.name === holdersTabName ? holdersTabLabel : itemProps.name
        }
      />
    ),
    [holdersTabLabel, holdersTabName],
  );

  return (
    <MarketDetailHeaderGesture panActiveOffsetY={[-4, 4]} scrollScale={1}>
      <YStack bg="$bgApp" pointerEvents="box-none">
        <Tabs.TabBar
          {...props}
          scrollable
          keepFocusedTabVisible
          textSize="$bodyMdMedium"
          onTabPress={handleTabPress}
          renderItem={renderTabBarItem}
        />
        <StickyHeader detailKind={detailKind} />
      </YStack>
    </MarketDetailHeaderGesture>
  );
}

// Stands in for the tab bar, its column header and the first rows while the
// token's network is unknown, using the same line boxes so nothing moves when
// the real tabs mount. Tab items are 44pt tall with a $pagePadding gap.
function PendingInformationTabs() {
  return (
    <YStack bg="$bgApp">
      <XStack h={44} pl="$5" gap="$5" ai="center">
        <Skeleton width="$20" height={18} borderRadius="$1" />
        <Skeleton width="$18" height={18} borderRadius="$1" />
        <Skeleton width="$16" height={18} borderRadius="$1" />
      </XStack>
      <XStack px="$5" pt="$3" pb="$1" jc="space-between" ai="center">
        <Skeleton width="$20" height={16} borderRadius="$1" />
        <Skeleton width="$12" height={16} borderRadius="$1" />
        <Skeleton width="$16" height={16} borderRadius="$1" />
      </XStack>
      <TransactionsSkeleton />
    </YStack>
  );
}

export function MobileInformationTabs({
  containerWidth,
  initialHeaderHeight,
  renderHeader,
  pendingHeader,
  onScrollEnd,
  portfolioData,
  isRefreshing,
  isPortfolioPending,
  tokenLogoUrl,
  scrollEnabled = true,
  freezeContent = false,
  detailKind = 'trending',
  marketAssetDetail,
  isMarketAssetDetailLoading,
}: {
  containerWidth?: number;
  initialHeaderHeight?: number;
  renderHeader: () => ReactElement | null;
  // Shown in place of the tabs until the token's network is known.
  pendingHeader?: ReactNode;
  onScrollEnd: () => void;
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  // The first holdings result for this token is not back yet.
  isPortfolioPending?: boolean;
  tokenLogoUrl?: string;
  scrollEnabled?: boolean;
  freezeContent?: boolean;
  detailKind?: IMarketMobileDetailKind;
  marketAssetDetail?: IMarketAssetDetailData;
  isMarketAssetDetailLoading?: boolean;
}) {
  const intl = useIntl();
  const { tokenAddress, networkId, tokenDetail, isNative, isStockToken } =
    useTokenDetail();
  const { stockId } = useStockDetail();
  const { accountAddress } = useNetworkAccountAddress(networkId);

  const holdersTabName = intl.formatMessage({
    id: ETranslations.dexmarket_holders,
  });
  const holdersTabLabel = useMemo(() => {
    const baseTitle = holdersTabName;
    const holders = tokenDetail?.holders;
    if (holders !== undefined && holders > 0) {
      const displayValue = String(
        formatDisplayNumber(NUMBER_FORMATTER.marketCap(String(holders))),
      );
      return `${baseTitle} (${displayValue})`;
    }
    return baseTitle;
  }, [holdersTabName, tokenDetail?.holders]);

  const isBTCNetwork = networkUtils.isBTCNetwork(networkId);
  const tabContainerWidth = useTabContainerWidth();
  const resolvedContainerWidth =
    containerWidth ?? (tabContainerWidth as number);

  const tabs = useMemo(() => {
    const overviewName = intl.formatMessage({
      id: ETranslations.global_overview,
    });
    const portfolioTab = (
      <Tabs.Tab
        key="portfolio"
        name={intl.formatMessage({
          id: ETranslations.dexmarket_details_myposition,
        })}
      >
        <DelayedFreeze freeze={freezeContent}>
          <Portfolio
            portfolioData={portfolioData}
            isRefreshing={!!isRefreshing}
            isPending={isPortfolioPending}
            accountAddress={accountAddress}
            tokenLogoUrl={tokenLogoUrl}
            scrollEnabled={scrollEnabled}
          />
        </DelayedFreeze>
      </Tabs.Tab>
    );

    if (detailKind === 'topCoin') {
      return [
        <Tabs.Tab key="overview" name={overviewName}>
          <DelayedFreeze freeze={freezeContent}>
            <MobileTopCoinsOverviewPanel
              scrollEnabled={scrollEnabled}
              assetDetail={marketAssetDetail}
              isAssetDetailLoading={isMarketAssetDetailLoading}
            />
          </DelayedFreeze>
        </Tabs.Tab>,
        portfolioTab,
      ];
    }

    if (detailKind === 'stock') {
      return [
        <Tabs.Tab key="overview" name={overviewName}>
          <DelayedFreeze freeze={freezeContent}>
            <MobileStockOverviewPanel scrollEnabled={scrollEnabled} />
          </DelayedFreeze>
        </Tabs.Tab>,
        stockId ? (
          <Tabs.Tab
            key="financials"
            name={intl.formatMessage({
              id: ETranslations.market_stock_financials__title,
            })}
          >
            <DelayedFreeze freeze={freezeContent}>
              <MobileStockFinancialsPanel scrollEnabled={scrollEnabled} />
            </DelayedFreeze>
          </Tabs.Tab>
        ) : null,
        portfolioTab,
      ].filter(Boolean);
    }

    // The footer summarizes the current token. The portfolio tab still lists
    // every position row.
    const shouldShowHoldersTab = !isNative && isHoldersTabSupported(networkId);
    const shouldShowTransactionsTab = !isBTCNetwork;
    const shouldShowLiquidityPoolsTab = !isNative && !isStockToken;

    return [
      <Tabs.Tab key="overview" name={overviewName}>
        <DelayedFreeze freeze={freezeContent}>
          <MobileTrendingOverviewPanel scrollEnabled={scrollEnabled} />
        </DelayedFreeze>
      </Tabs.Tab>,
      shouldShowTransactionsTab && (
        <Tabs.Tab
          key="transactions"
          name={intl.formatMessage({
            id: ETranslations.dexmarket_details_transactions,
          })}
        >
          <DelayedFreeze freeze={freezeContent}>
            <TransactionsHistory
              tokenAddress={tokenAddress}
              networkId={networkId}
              onScrollEnd={onScrollEnd}
              scrollEnabled={scrollEnabled}
            />
          </DelayedFreeze>
        </Tabs.Tab>
      ),
      portfolioTab,
      shouldShowLiquidityPoolsTab && (
        <Tabs.Tab
          key="liquidityPools"
          name={intl.formatMessage({
            id: ETranslations.global_liquidity,
          })}
        >
          <DelayedFreeze freeze={freezeContent}>
            <MarketDetailScrollView scrollEnabled={scrollEnabled}>
              <TokenLiquidityPools
                showTitle={false}
                variant="mobile"
                px="$0"
                pt="$0"
                pb="$20"
              />
            </MarketDetailScrollView>
          </DelayedFreeze>
        </Tabs.Tab>
      ),
      shouldShowHoldersTab && (
        <Tabs.Tab key="holders" name={holdersTabName}>
          <DelayedFreeze freeze={freezeContent}>
            <Holders
              tokenAddress={tokenAddress}
              networkId={networkId}
              scrollEnabled={scrollEnabled}
            />
          </DelayedFreeze>
        </Tabs.Tab>
      ),
    ].filter(Boolean);
  }, [
    intl,
    tokenAddress,
    networkId,
    onScrollEnd,
    holdersTabName,
    accountAddress,
    portfolioData,
    isRefreshing,
    isPortfolioPending,
    isNative,
    isBTCNetwork,
    tokenLogoUrl,
    isStockToken,
    scrollEnabled,
    freezeContent,
    detailKind,
    marketAssetDetail,
    isMarketAssetDetailLoading,
    stockId,
  ]);

  const tabKeys = useMemo(() => tabs.map((tab) => String(tab.key)), [tabs]);
  const { handleTabChange: trackTabChange } = useBottomTabAnalytics(tabKeys);
  const { preferPosition, recordTabChange } = useMarketDetailPositionTab();
  const positionTabName = intl.formatMessage({
    id: ETranslations.dexmarket_details_myposition,
  });
  const handleTabChange = useCallback(
    (data: { index: number; tabName: string }) => {
      recordTabChange(data.tabName === positionTabName);
      trackTabChange(data);
    },
    [positionTabName, recordTabChange, trackTabChange],
  );

  const renderTabBar = useCallback(
    (props: IAppPagerTabBarProps) => (
      <MobileInformationTabsHeader
        {...props}
        holdersTabName={holdersTabName}
        holdersTabLabel={holdersTabLabel}
        detailKind={detailKind}
      />
    ),
    [detailKind, holdersTabLabel, holdersTabName],
  );

  // Generate unique key based on tabs composition
  const tabsKey = useMemo(() => tabKeys.join('-'), [tabKeys]);

  // Stock tabs are independent of the selected token network. Other tab sets
  // wait for it so their header does not remount when the network resolves.
  if (!networkId && detailKind !== 'stock') {
    return pendingHeader ? (
      <YStack>
        {pendingHeader}
        <PendingInformationTabs />
      </YStack>
    ) : null;
  }

  const initialStickyHeight = preferPosition ? 89 : 45;
  return (
    <MarketDetailPager
      key={tabsKey}
      initialHeaderHeight={initialHeaderHeight}
      initialStickyHeaderHeight={
        initialHeaderHeight === undefined ? undefined : initialStickyHeight
      }
      width={platformEnv.isNative ? resolvedContainerWidth : undefined}
      scrollEnabled={scrollEnabled}
      renderHeader={renderHeader}
      renderTabBar={renderTabBar}
      // Opens on My position when that was the last tab picked on any detail
      // page; read once when the tabs mount.
      initialTabName={preferPosition ? positionTabName : undefined}
      onTabChange={handleTabChange}
    >
      {tabs}
    </MarketDetailPager>
  );
}
