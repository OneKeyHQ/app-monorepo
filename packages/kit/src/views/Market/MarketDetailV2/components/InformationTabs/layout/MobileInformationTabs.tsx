import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Stack, Tabs, YStack, useMedia } from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { Holders } from '../components/Holders';
import {
  HoldersHeaderNormal,
  HoldersHeaderSmall,
} from '../components/Holders/layout';
import {
  TransactionsHeaderNormal,
  TransactionsHeaderSmall,
  TransactionsHistory,
} from '../components/TransactionsHistory';

import type {
  CollapsibleProps,
  TabBarProps,
} from 'react-native-collapsible-tab-view';

function MobileInformationTabsHeader(props: TabBarProps<string>) {
  const { gtLg } = useMedia();
  const focusedTab = useFocusedTab();

  const transactionsHeader = useMemo(() => {
    return gtLg ? <TransactionsHeaderNormal /> : <TransactionsHeaderSmall />;
  }, [gtLg]);

  const holdersHeader = useMemo(() => {
    return gtLg ? <HoldersHeaderNormal /> : <HoldersHeaderSmall />;
  }, [gtLg]);

  const firstTabName = useMemo(() => {
    const { tabNames } = props;
    return tabNames[0];
  }, [props]);

  return (
    <YStack>
      <Tabs.TabBar {...props} />
      {focusedTab === firstTabName ? transactionsHeader : holdersHeader}
    </YStack>
  );
}

export function MobileInformationTabs({
  renderHeader,
}: {
  renderHeader: CollapsibleProps['renderHeader'];
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
  }, [intl, tokenAddress, networkId, shouldShowHolders]);

  const { gtLg } = useMedia();

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
