import { useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  DebugRenderTracker,
  SizableText,
  Tabs,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  useSpotActiveOpenOrdersAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsAccountScopedCacheAddress } from '../../hooks/usePerpsAccountScopedCacheAddress';
import { isHyperLiquidUnifiedAccountMode } from '../../utils';
import { getPerpsAccountScopedListData } from '../../utils/accountScopedData';

import { PerpAccountList } from './List/PerpAccountList';
import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';
import { SpotBalanceList } from './List/SpotBalanceList';

const tabNameToTranslationKey: Record<string, ETranslations> = {
  'Positions': ETranslations.perp_position_title,
  'Open Orders': ETranslations.perp_open_orders_title,
  'Trades History': ETranslations.perp_trades_history_title,
  'Account': ETranslations.perp_account_history,
  'Balances': ETranslations.perp_holdings_tokens,
};

function TabBarItem({
  name,
  isFocused,
  onPress,
}: {
  name: string;
  isFocused: boolean;
  onPress: (name: string) => void;
}) {
  const intl = useIntl();

  const [perpOpenOrdersState] = usePerpsActiveOpenOrdersAtom();
  const [spotOpenOrdersState] = useSpotActiveOpenOrdersAtom();
  const [positionsState] = usePerpsActivePositionAtom();
  const [{ balances }] = useSpotBalancesAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const accountScopedAddress = usePerpsAccountScopedCacheAddress();
  const [abstractionMode] = usePerpsAbstractionModeAtom();
  const isUnifiedAccountMode = isHyperLiquidUnifiedAccountMode(
    abstractionMode,
    currentUser?.accountAddress,
  );
  const currentAccountAddress = accountScopedAddress;
  const positionsLength = getPerpsAccountScopedListData({
    activeAccountAddress: currentAccountAddress,
    dataAccountAddress: positionsState.accountAddress,
    data: positionsState.activePositions,
  }).length;
  const openOrdersLength =
    getPerpsAccountScopedListData({
      activeAccountAddress: currentAccountAddress,
      dataAccountAddress: perpOpenOrdersState.accountAddress,
      data: perpOpenOrdersState.openOrders.filter(
        (order) => !isSpotInstrument(order.coin),
      ),
    }).length +
    getPerpsAccountScopedListData({
      activeAccountAddress: currentAccountAddress,
      dataAccountAddress: spotOpenOrdersState.accountAddress,
      data: spotOpenOrdersState.openOrders,
    }).length;

  const holdingsCount = useMemo(() => {
    // Mirrors the USDC merge in SpotBalanceList.
    const nonUsdcSpotCount = balances.filter(
      (item) => item.coin !== 'USDC' && !new BigNumber(item.total).isZero(),
    ).length;
    const hasSpotUsdc = balances.some(
      (item) => item.coin === 'USDC' && !new BigNumber(item.total).isZero(),
    );
    const hasPerpsUsdc =
      !isUnifiedAccountMode &&
      !!accountSummary?.totalRawUsd &&
      new BigNumber(accountSummary.totalRawUsd).gt(0);
    return nonUsdcSpotCount + (hasSpotUsdc || hasPerpsUsdc ? 1 : 0);
  }, [accountSummary?.totalRawUsd, balances, isUnifiedAccountMode]);

  const tabCount = useMemo(() => {
    if (name === 'Balances') {
      return holdingsCount > 0 ? `(${holdingsCount})` : '';
    }
    if (name === 'Trades History') {
      return '';
    }
    if (name === 'Positions' && positionsLength > 0) {
      return `(${positionsLength})`;
    }
    if (name === 'Open Orders' && openOrdersLength > 0) {
      return `(${openOrdersLength})`;
    }
    return '';
  }, [holdingsCount, positionsLength, openOrdersLength, name]);

  const translationKey = tabNameToTranslationKey[name];
  const tabTitle = intl.formatMessage({
    id: translationKey,
  });

  const displayTitle =
    name === 'Balances' ? `${tabTitle}${tabCount}` : `${tabTitle} ${tabCount}`;

  return (
    <DebugRenderTracker
      position="bottom-center"
      name={`PerpOrderInfoPanel_TabBarItem_${name}`}
    >
      <XStack
        py="$3"
        ml="$5"
        mr="$2"
        borderBottomWidth={isFocused ? '$0.5' : '$0'}
        borderBottomColor="$borderActive"
        onPress={() => onPress(name)}
        cursor="pointer"
      >
        <SizableText size="$bodyMdMedium">{displayTitle.trim()}</SizableText>
      </XStack>
    </DebugRenderTracker>
  );
}

function PerpOrderInfoPanel() {
  const tabsRef = useRef<ITabContainerRef | null>(null);
  const actions = useHyperliquidActions();
  const [activeTab, setActiveTab] = useState('Positions');

  const handleViewTpslOrders = () => {
    tabsRef.current?.jumpToTab('Open Orders');
  };

  return (
    <Tabs.Container
      ref={tabsRef as any}
      headerHeight={80}
      initialTabName="Positions"
      disableScroll={!platformEnv.isNative}
      onTabChange={async (tab) => {
        setActiveTab(tab.tabName);
        actions.current.setTradeRouteViewState({ infoPanelTab: tab.tabName });
        if (tab.tabName === 'Account') {
          void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
        }
      }}
      renderTabBar={(props) => (
        <Tabs.TabBar
          {...props}
          renderItem={({ name, isFocused, onPress }) => (
            <TabBarItem
              key={name}
              name={name}
              isFocused={isFocused}
              onPress={onPress}
            />
          )}
          containerStyle={{
            borderRadius: 0,
            margin: 0,
            padding: 0,
            cursor: 'default',
          }}
        />
      )}
    >
      <Tabs.Tab name="Balances">
        <SpotBalanceList />
      </Tabs.Tab>
      <Tabs.Tab name="Positions">
        <PerpPositionsList handleViewTpslOrders={handleViewTpslOrders} />
      </Tabs.Tab>
      <Tabs.Tab name="Open Orders">
        <PerpOpenOrdersList />
      </Tabs.Tab>
      <Tabs.Tab name="Trades History">
        <PerpTradesHistoryList useTabsList />
      </Tabs.Tab>
      <Tabs.Tab name="Account">
        <PerpAccountList useTabsList isActive={activeTab === 'Account'} />
      </Tabs.Tab>
    </Tabs.Container>
  );
}

export { PerpOrderInfoPanel };
