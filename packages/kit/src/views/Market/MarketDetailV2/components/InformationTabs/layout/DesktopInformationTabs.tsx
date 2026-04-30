import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import Svg, { Path } from 'react-native-svg';

import {
  Badge,
  Icon,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useMarketTransactionsRealtimePauseAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { isHoldersTabSupported } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { TokenLiquidityPools } from '../../TokenLiquidityPools';
import { Holders } from '../components/Holders';
import { Portfolio } from '../components/Portfolio';
import { TransactionsHistory } from '../components/TransactionsHistory';
import { MAX_BUFFERED_TRANSACTIONS } from '../components/TransactionsHistory/hooks/transactionBufferUtils';
import { useBottomTabAnalytics } from '../hooks/useBottomTabAnalytics';
import { useNetworkAccountAddress } from '../hooks/useNetworkAccountAddress';

import { StickyHeader } from './StickyHeader';

import type { TabBarProps } from 'react-native-collapsible-tab-view';

function UpdatesArrowIcon() {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      accessibilityRole="image"
    >
      <Path
        d="M2.91675 6.9974L7.00008 2.91406L11.0834 6.9974"
        stroke="white"
        strokeOpacity={0.926}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 11.0807V2.91406"
        stroke="white"
        strokeOpacity={0.926}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DesktopInformationTabsHeader(props: TabBarProps<string>) {
  const { tabNames } = props;
  const [realtimePauseState] = useMarketTransactionsRealtimePauseAtom();
  const intl = useIntl();
  const firstTabName = useMemo(() => {
    return tabNames[0];
  }, [tabNames]);
  const hasBufferedUpdates =
    realtimePauseState.isPaused && realtimePauseState.bufferedCount > 0;
  const updatesAmount = realtimePauseState.hasBufferOverflow
    ? `${MAX_BUFFERED_TRANSACTIONS}+`
    : String(realtimePauseState.bufferedCount);
  const updatesText = intl.formatMessage(
    { id: ETranslations.marketdex_new_updates },
    { amount: updatesAmount },
  );
  const { resumeRealtimeUpdates, scrollTransactionsToTop } = realtimePauseState;
  const handleUpdatesPress = useCallback(() => {
    resumeRealtimeUpdates?.();
    scrollTransactionsToTop?.();
  }, [resumeRealtimeUpdates, scrollTransactionsToTop]);

  return (
    <YStack
      className="market-transactions-sticky-header"
      bg="$bgApp"
      pointerEvents="box-none"
      position={'sticky' as any}
      top={0}
      zIndex={10}
      overflow="visible"
    >
      <Tabs.TabBar {...props} textSize="$bodyMdMedium" />
      {realtimePauseState.isPaused ? (
        <Badge
          position="absolute"
          right="$4"
          top={12}
          zIndex={30}
          badgeType="warning"
          badgeSize="sm"
          gap="$1.5"
          justifyContent="center"
          pointerEvents="none"
        >
          <Icon name="PauseOutline" size="$4" color="$iconCaution" />
          <Badge.Text>
            {intl.formatMessage({ id: ETranslations.marketdex_paused })}
          </Badge.Text>
        </Badge>
      ) : null}
      <StickyHeader firstTabName={firstTabName} />
      {hasBufferedUpdates ? (
        <XStack
          position="absolute"
          left={0}
          right={0}
          bottom={-30}
          zIndex={20}
          justifyContent="center"
          pointerEvents="box-none"
        >
          <XStack
            px="$3"
            py="$1"
            gap="$1"
            alignItems="center"
            borderRadius="$full"
            bg="$bgInverse"
            elevation={8}
            shadowColor="black"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.2}
            shadowRadius={12}
            cursor="pointer"
            hoverStyle={{ opacity: 0.9 }}
            pressStyle={{ opacity: 0.8 }}
            pointerEvents="auto"
            onMouseEnter={realtimePauseState.handleRealtimePauseHoverIn}
            onMouseLeave={realtimePauseState.handleRealtimePauseHoverOut}
            onPress={handleUpdatesPress}
          >
            <UpdatesArrowIcon />
            <SizableText size="$bodySmMedium" color="$textInverse">
              {updatesText}
            </SizableText>
          </XStack>
        </XStack>
      ) : null}
    </YStack>
  );
}

interface IDesktopInformationTabsProps {
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  isBTCNetwork?: boolean;
  tokenLogoUrl?: string;
}

export function DesktopInformationTabs({
  portfolioData,
  isRefreshing,
  isBTCNetwork,
  tokenLogoUrl,
}: IDesktopInformationTabsProps) {
  const intl = useIntl();
  const { tokenAddress, networkId, tokenDetail, isNative, isStockToken } =
    useTokenDetail();
  const { accountAddress } = useNetworkAccountAddress(networkId);

  const holdersTabName = useMemo(() => {
    const baseTitle = intl.formatMessage({
      id: ETranslations.dexmarket_holders,
    });
    const holders = tokenDetail?.holders;
    if (holders !== undefined && holders > 0) {
      const displayValue = String(
        formatDisplayNumber(NUMBER_FORMATTER.marketCap(String(holders))),
      );
      return `${baseTitle} (${displayValue})`;
    }
    return baseTitle;
  }, [intl, tokenDetail?.holders]);

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
          <TransactionsHistory
            tokenAddress={tokenAddress}
            networkId={networkId}
          />
        </Tabs.Tab>
      ),
      <Tabs.Tab
        key="portfolio"
        name={intl.formatMessage({
          id: ETranslations.dexmarket_details_myposition,
        })}
      >
        <Portfolio
          portfolioData={portfolioData}
          isRefreshing={isRefreshing}
          accountAddress={accountAddress}
          tokenLogoUrl={tokenLogoUrl}
        />
      </Tabs.Tab>,
      shouldShowLiquidityPoolsTab && (
        <Tabs.Tab
          key="liquidityPools"
          name={intl.formatMessage({
            id: ETranslations.global_liquidity,
          })}
        >
          <Tabs.ScrollView>
            <TokenLiquidityPools
              showTitle={false}
              variant="desktop"
              px="$0"
              pt="$0"
              pb="$4"
            />
          </Tabs.ScrollView>
        </Tabs.Tab>
      ),
      shouldShowHoldersTab && (
        <Tabs.Tab key="holders" name={holdersTabName}>
          <Holders tokenAddress={tokenAddress} networkId={networkId} />
        </Tabs.Tab>
      ),
    ].filter(Boolean);
    return items;
  }, [
    networkId,
    accountAddress,
    intl,
    tokenAddress,
    portfolioData,
    isRefreshing,
    holdersTabName,
    isNative,
    tokenLogoUrl,
    isBTCNetwork,
    isStockToken,
  ]);

  const tabKeys = useMemo(() => tabs.map((tab) => String(tab.key)), [tabs]);
  const { handleTabChange } = useBottomTabAnalytics(tabKeys);

  const renderTabBar = useCallback(({ ...props }: any) => {
    return <DesktopInformationTabsHeader {...props} />;
  }, []);

  // Generate unique key based on tabs composition
  const tabsKey = useMemo(() => tabKeys.join('-'), [tabKeys]);

  // Hide entire component if no networkId
  if (!networkId) {
    return null;
  }

  return (
    <Tabs.Container
      key={tabsKey}
      renderTabBar={renderTabBar}
      onTabChange={handleTabChange}
      disableScroll={!platformEnv.isNative}
    >
      {tabs}
    </Tabs.Container>
  );
}
