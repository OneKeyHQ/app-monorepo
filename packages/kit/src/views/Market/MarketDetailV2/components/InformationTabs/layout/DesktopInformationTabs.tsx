import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Tabs, YStack } from '@onekeyhq/components';
import { isHoldersTabSupported } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

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
      <Tabs.TabBar {...props} />
      <StickyHeader firstTabName={firstTabName} />
    </YStack>
  );
}

export function DesktopInformationTabs() {
  const intl = useIntl();
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();
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
    // Check if current network supports holders tab
    const shouldShowHoldersTab = isHoldersTabSupported(networkId);
    // Check if there's an account address available
    const shouldShowPortfolioTab = !!accountAddress;

    const items = [
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
      </Tabs.Tab>,
      shouldShowPortfolioTab && (
        <Tabs.Tab
          key="portfolio"
          name={intl.formatMessage({
            id: ETranslations.dexmarket_details_myposition,
          })}
        >
          <Portfolio
            tokenAddress={tokenAddress}
            networkId={networkId}
            accountAddress={accountAddress}
          />
        </Tabs.Tab>
      ),
      shouldShowHoldersTab && (
        <Tabs.Tab key="holders" name={holdersTabName}>
          <Holders tokenAddress={tokenAddress} networkId={networkId} />
        </Tabs.Tab>
      ),
    ].filter(Boolean);
    return items;
  }, [intl, tokenAddress, networkId, holdersTabName, accountAddress]);

  const renderTabBar = useCallback(({ ...props }: any) => {
    return <DesktopInformationTabsHeader {...props} />;
  }, []);

  if (!tokenAddress || !networkId) {
    return null;
  }

  return (
    <Tabs.Container renderTabBar={renderTabBar} onTabChange={handleTabChange}>
      {tabs}
    </Tabs.Container>
  );
}
