import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Tabs, YStack } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import { TransactionsHistory } from '../components/TransactionsHistory';

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
  const { tokenAddress, networkId } = useTokenDetail();

  const shouldShowHolders = useMemo(() => {
    return networkId === getNetworkIdsMap().sol;
  }, [networkId]);

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
        <Tabs.Tab
          key="holders"
          name={intl.formatMessage({
            id: ETranslations.dexmarket_holders,
          })}
        >
          <Holders tokenAddress={tokenAddress} networkId={networkId} />
        </Tabs.Tab>,
      );
    }
    return items;
  }, [intl, tokenAddress, networkId, onScrollEnd, shouldShowHolders]);

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
    >
      {tabs}
    </Tabs.Container>
  );
}
