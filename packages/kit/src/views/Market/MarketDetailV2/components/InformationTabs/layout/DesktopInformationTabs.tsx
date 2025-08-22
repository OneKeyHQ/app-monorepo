import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Tabs, YStack } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabSelect } from '@onekeyhq/shared/src/logger/scopes/dex/types';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { TransactionsHistory } from '../components/TransactionsHistory';

import { StickyHeader } from './StickyHeader';

import type { TabBarProps } from 'react-native-collapsible-tab-view';

function DesktopInformationTabsHeader(props: TabBarProps<string>) {
  const { tabNames } = props;
  const intl = useIntl();

  const firstTabName = useMemo(() => {
    return tabNames[0];
  }, [tabNames]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      // Map tab names to enum values
      const transactionsTabName = intl.formatMessage({
        id: ETranslations.dexmarket_details_transactions,
      });
      const holdersTabName = intl.formatMessage({
        id: ETranslations.dexmarket_holders,
      });

      let tabSelect: ETabSelect;
      if (tabName === transactionsTabName) {
        tabSelect = ETabSelect.Transactions;
      } else if (tabName === holdersTabName) {
        tabSelect = ETabSelect.Holders;
      } else {
        tabSelect = ETabSelect.Transactions; // default
      }

      // Add DEX button tab tracking
      defaultLogger.dex.chart.dexButtonTab({ tabSelect });

      // Call original onTabPress if exists
      const { onTabPress } = props;
      onTabPress?.(tabName);
    },
    [intl, props],
  );

  return (
    <YStack
      bg="$bgApp"
      pointerEvents="box-none"
      position={'sticky' as any}
      top={0}
      zIndex={10}
    >
      <Tabs.TabBar {...props} onTabPress={handleTabPress} />
      <StickyHeader firstTabName={firstTabName} />
    </YStack>
  );
}

export function DesktopInformationTabs() {
  const intl = useIntl();
  const { tokenAddress, networkId } = useTokenDetail();
  const networkIdsMap = getNetworkIdsMap();

  const renderTabBar = useCallback(({ ...props }: any) => {
    return <DesktopInformationTabsHeader {...props} />;
  }, []);

  if (!tokenAddress || !networkId) {
    return null;
  }

  return (
    <Tabs.Container renderTabBar={renderTabBar}>
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.dexmarket_details_transactions,
        })}
      >
        <TransactionsHistory
          tokenAddress={tokenAddress}
          networkId={networkId}
        />
      </Tabs.Tab>

      {networkId === networkIdsMap.sol ? (
        <Tabs.Tab
          name={intl.formatMessage({
            id: ETranslations.dexmarket_holders,
          })}
        >
          <Holders tokenAddress={tokenAddress} networkId={networkId} />
        </Tabs.Tab>
      ) : null}
    </Tabs.Container>
  );
}
