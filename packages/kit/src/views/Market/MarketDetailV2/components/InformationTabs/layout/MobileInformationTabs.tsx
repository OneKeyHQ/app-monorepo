import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  DelayedFreeze,
  HeaderScrollGestureWrapper,
  Skeleton,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useTabContainerWidth } from '@onekeyhq/kit/src/hooks/useTabContainerWidth';
import { isHoldersTabSupported } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

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

import { StickyHeader } from './StickyHeader';

import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';

function MobileInformationTabsHeader({
  holdersTabLabel,
  holdersTabName,
  ...props
}: TabBarProps<string> & {
  holdersTabLabel: string;
  holdersTabName: string;
}) {
  const { tabNames, focusedTab, onTabPress } = props;
  const firstTabName = useMemo(() => {
    return tabNames[0];
  }, [tabNames]);

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
    <HeaderScrollGestureWrapper panActiveOffsetY={[-4, 4]} scrollScale={1}>
      <YStack bg="$bgApp" pointerEvents="box-none">
        <Tabs.TabBar
          {...props}
          textSize="$bodyMdMedium"
          onTabPress={handleTabPress}
          renderItem={renderTabBarItem}
        />
        <StickyHeader firstTabName={firstTabName} />
      </YStack>
    </HeaderScrollGestureWrapper>
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
  renderHeader,
  pendingHeader,
  onScrollEnd,
  portfolioData,
  isRefreshing,
  tokenLogoUrl,
  scrollEnabled = true,
  freezeContent = false,
}: {
  containerWidth?: number;
  renderHeader: CollapsibleProps['renderHeader'];
  // Shown in place of the tabs until the token's network is known.
  pendingHeader?: ReactNode;
  onScrollEnd: () => void;
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  tokenLogoUrl?: string;
  scrollEnabled?: boolean;
  freezeContent?: boolean;
}) {
  const intl = useIntl();
  const { tokenAddress, networkId, tokenDetail, isNative, isStockToken } =
    useTokenDetail();
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
    // Check if current network supports holders tab (not available for native tokens)
    const shouldShowHoldersTab = !isNative && isHoldersTabSupported(networkId);
    // BTC network doesn't show transactions tab
    const shouldShowTransactionsTab = !isBTCNetwork;
    const shouldShowLiquidityPoolsTab = !isNative && !isStockToken;

    const items = [
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
            accountAddress={accountAddress}
            tokenLogoUrl={tokenLogoUrl}
            scrollEnabled={scrollEnabled}
          />
        </DelayedFreeze>
      </Tabs.Tab>,
      shouldShowLiquidityPoolsTab && (
        <Tabs.Tab
          key="liquidityPools"
          name={intl.formatMessage({
            id: ETranslations.global_liquidity,
          })}
        >
          <DelayedFreeze freeze={freezeContent}>
            <Tabs.ScrollView scrollEnabled={scrollEnabled}>
              <TokenLiquidityPools
                showTitle={false}
                variant="mobile"
                px="$0"
                pt="$0"
                pb="$20"
              />
            </Tabs.ScrollView>
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
    return items;
  }, [
    intl,
    tokenAddress,
    networkId,
    onScrollEnd,
    holdersTabName,
    accountAddress,
    portfolioData,
    isRefreshing,
    isNative,
    isBTCNetwork,
    tokenLogoUrl,
    isStockToken,
    scrollEnabled,
    freezeContent,
  ]);

  const tabKeys = useMemo(() => tabs.map((tab) => String(tab.key)), [tabs]);
  const { handleTabChange } = useBottomTabAnalytics(tabKeys);

  const renderTabBar = useCallback(
    (props: TabBarProps<string>) => (
      <MobileInformationTabsHeader
        {...props}
        holdersTabName={holdersTabName}
        holdersTabLabel={holdersTabLabel}
      />
    ),
    [holdersTabLabel, holdersTabName],
  );

  // Generate unique key based on tabs composition
  const tabsKey = useMemo(() => tabKeys.join('-'), [tabKeys]);

  // The tab set depends on the network, so hold only the header until the
  // stock variant resolves instead of mounting tabs that remount right away.
  if (!networkId) {
    return pendingHeader ? (
      <YStack>
        {pendingHeader}
        <PendingInformationTabs />
      </YStack>
    ) : null;
  }

  return (
    <Tabs.Container
      key={tabsKey}
      width={platformEnv.isNative ? resolvedContainerWidth : undefined}
      headerContainerStyle={{
        width: '100%',
        shadowColor: 'transparent',
      }}
      renderHeader={renderHeader}
      renderTabBar={renderTabBar}
      onTabChange={handleTabChange}
    >
      {tabs}
    </Tabs.Container>
  );
}
