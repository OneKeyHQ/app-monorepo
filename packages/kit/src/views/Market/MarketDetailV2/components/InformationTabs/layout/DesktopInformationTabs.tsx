import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Tabs, YStack } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { TransactionsHistory } from '../components/TransactionsHistory';

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
