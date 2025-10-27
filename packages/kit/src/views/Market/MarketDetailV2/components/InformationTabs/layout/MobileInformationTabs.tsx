import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Tabs, YStack } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { TransactionsHistory } from '../components/TransactionsHistory';
import { useBottomTabAnalytics } from '../hooks/useBottomTabAnalytics';

import { StickyHeader } from './StickyHeader';

import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';

function MobileInformationTabsHeader(props: TabBarProps<string>) {
  const { tabNames } = props;
  const firstTabName = useMemo(() => {
    return tabNames[0];
  }, [tabNames]);
  return (
    <YStack bg="$bgApp" pointerEvents="box-none">
      <Tabs.TabBar {...props} />
      <StickyHeader firstTabName={firstTabName} />
    </YStack>
  );
}

export function MobileInformationTabs({
  renderHeader,
  onScrollEnd,
}: {
  renderHeader: CollapsibleProps['renderHeader'];
  onScrollEnd: () => void;
}) {
  const intl = useIntl();
  const { tokenAddress, networkId, tokenDetail } = useTokenDetail();
  const { handleTabChange } = useBottomTabAnalytics();

  const shouldShowHolders = useMemo(() => {
    return networkId === getNetworkIdsMap().sol;
  }, [networkId]);

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
          onScrollEnd={onScrollEnd}
        />
      </Tabs.Tab>,
    ];
    if (shouldShowHolders) {
      items.push(
        <Tabs.Tab key="holders" name={holdersTabName}>
          <Holders tokenAddress={tokenAddress} networkId={networkId} />
        </Tabs.Tab>,
      );
    }
    return items;
  }, [
    intl,
    tokenAddress,
    networkId,
    onScrollEnd,
    shouldShowHolders,
    holdersTabName,
  ]);

  const renderTabBar = useCallback(({ ...props }: any) => {
    return <MobileInformationTabsHeader {...props} />;
  }, []);

  if (!tokenAddress || !networkId) {
    return null;
  }

  return (
    <Tabs.Container
      key={tabs.length}
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
