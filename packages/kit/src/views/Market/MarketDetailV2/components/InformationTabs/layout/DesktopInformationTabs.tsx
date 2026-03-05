import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Tabs, YStack } from '@onekeyhq/components';
import { isHoldersTabSupported } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { Portfolio } from '../components/Portfolio';
import { TransactionsHistory } from '../components/TransactionsHistory';
import { useBottomTabAnalytics } from '../hooks/useBottomTabAnalytics';
import { useNetworkAccountAddress } from '../hooks/useNetworkAccountAddress';

import { StickyHeader } from './StickyHeader';

import type { TabBarProps } from 'react-native-collapsible-tab-view';

function DesktopInformationTabsHeader(props: TabBarProps<string>) {
  const { tabNames } = props;
  const firstTabName = useMemo(() => {
    return tabNames[0];
  }, [tabNames]);
  return (
    <YStack
      bg="$bgApp"
      pointerEvents="box-none"
      position={'sticky' as any}
      top={0}
      zIndex={10}
    >
      <Tabs.TabBar {...props} textSize="$bodyMdMedium" />
      <StickyHeader firstTabName={firstTabName} />
    </YStack>
  );
}

interface IDesktopInformationTabsProps {
  portfolioData: IMarketAccountPortfolioItem[];
  isRefreshing?: boolean;
  isBTCNetwork?: boolean;
}

export function DesktopInformationTabs({
  portfolioData,
  isRefreshing,
  isBTCNetwork,
}: IDesktopInformationTabsProps) {
  const intl = useIntl();
  const { tokenAddress, networkId, tokenDetail, isNative } = useTokenDetail();
  const { handleTabChange } = useBottomTabAnalytics();
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
        />
      </Tabs.Tab>,
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
    isBTCNetwork,
  ]);

  const renderTabBar = useCallback(({ ...props }: any) => {
    return <DesktopInformationTabsHeader {...props} />;
  }, []);

  // Generate unique key based on tabs composition
  const tabsKey = useMemo(() => tabs.map((tab) => tab.key).join('-'), [tabs]);

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
