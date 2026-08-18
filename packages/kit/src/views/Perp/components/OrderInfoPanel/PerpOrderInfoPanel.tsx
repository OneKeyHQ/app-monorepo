import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  DebugRenderTracker,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
  usePerpsActiveTwapOrdersAtom,
  useTradeRouteViewStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsPendingInfoPanelTabAtom,
  useSpotActiveOpenOrdersAtom,
  useSpotBalancesAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpsAccountScopedCacheAddress } from '../../hooks/usePerpsAccountScopedCacheAddress';
import { useShowUnifoldDepositTracker } from '../../hooks/useShowDepositWithdrawModal';
import { isHyperLiquidUnifiedAccountMode } from '../../utils';
import { getPerpsAccountScopedListData } from '../../utils/accountScopedData';

import { PerpAccountList } from './List/PerpAccountList';
import { PerpOpenOrdersList } from './List/PerpOpenOrdersList';
import { PerpPositionsList } from './List/PerpPositionsList';
import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';
import { PerpTwapList } from './List/PerpTwapList';
import { SpotBalanceList } from './List/SpotBalanceList';

const tabNameToTranslationKey: Partial<Record<string, ETranslations>> = {
  'Positions': ETranslations.perp_position_title,
  'Open Orders': ETranslations.perp_open_orders_title,
  'TWAP': ETranslations.perp_twap_order__title,
  'Trades History': ETranslations.perp_trades_history_title,
  'Account': ETranslations.perp_account_history,
  'Balances': ETranslations.perp_holdings_tokens,
};

const ORDER_INFO_TABS = [
  'Balances',
  'Positions',
  'Open Orders',
  'TWAP',
  'Trades History',
  'Account',
] as const;

type IOrderInfoTabName = (typeof ORDER_INFO_TABS)[number];

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
  const [twapOrdersState] = usePerpsActiveTwapOrdersAtom();
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
  const twapOrdersLength = getPerpsAccountScopedListData({
    activeAccountAddress: currentAccountAddress,
    dataAccountAddress: twapOrdersState.accountAddress,
    data: twapOrdersState.twapOrders,
  }).length;

  const holdingsCount = useMemo(() => {
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
    if (name === 'TWAP' && twapOrdersLength > 0) {
      return `(${twapOrdersLength})`;
    }
    return '';
  }, [
    holdingsCount,
    name,
    openOrdersLength,
    positionsLength,
    twapOrdersLength,
  ]);

  const translationKey = tabNameToTranslationKey[name];
  const tabTitle = translationKey
    ? intl.formatMessage({
        id: translationKey,
      })
    : name;

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
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const [tradeRouteViewState] = useTradeRouteViewStateAtom();
  const [pendingInfoPanelTab, setPendingInfoPanelTab] =
    usePerpsPendingInfoPanelTabAtom();
  const initialTabName =
    tradeRouteViewState.infoPanelTab === 'Balances' ? 'Balances' : 'Positions';
  const [activeTab, setActiveTab] = useState<string>(initialTabName);
  const { isUnifoldDepositTrackerAvailable, showUnifoldDepositTracker } =
    useShowUnifoldDepositTracker();

  const handleShowUnifoldDepositTracker = useCallback(() => {
    void showUnifoldDepositTracker();
  }, [showUnifoldDepositTracker]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      setActiveTab(tabName);
      actions.current.setTradeRouteViewState({ infoPanelTab: tabName });
      if (tabName === 'Account') {
        void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
      }
    },
    [actions],
  );

  useEffect(() => {
    if (!pendingInfoPanelTab) {
      return;
    }
    setActiveTab(pendingInfoPanelTab);
    actions.current.setTradeRouteViewState({
      infoPanelTab: pendingInfoPanelTab,
    });
    void setPendingInfoPanelTab(undefined);
  }, [actions, pendingInfoPanelTab, setPendingInfoPanelTab]);

  useEffect(() => {
    const handler = (payload: { tab: 'Positions' | 'Balances' }) => {
      setActiveTab(payload.tab);
      actions.current.setTradeRouteViewState({ infoPanelTab: payload.tab });
    };
    appEventBus.on(EAppEventBusNames.PerpSwitchInfoPanelTab, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.PerpSwitchInfoPanelTab, handler);
    };
  }, [actions]);

  const handleViewTpslOrders = useCallback(() => {
    handleTabPress('Open Orders');
  }, [handleTabPress]);

  const renderTabContent = (name: IOrderInfoTabName) => {
    switch (name) {
      case 'Balances':
        return <SpotBalanceList />;
      case 'Positions':
        return (
          <PerpPositionsList handleViewTpslOrders={handleViewTpslOrders} />
        );
      case 'Open Orders':
        return <PerpOpenOrdersList />;
      case 'TWAP':
        return <PerpTwapList />;
      case 'Trades History':
        return <PerpTradesHistoryList useTabsList={false} />;
      case 'Account':
        return (
          <PerpAccountList
            useTabsList={false}
            isActive={activeTab === 'Account'}
          />
        );
      default:
        return null;
    }
  };

  return (
    <YStack flex={1}>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <XStack>
          {ORDER_INFO_TABS.map((name) => (
            <TabBarItem
              key={name}
              name={name}
              isFocused={activeTab === name}
              onPress={handleTabPress}
            />
          ))}
        </XStack>
        {activeTab === 'Account' && isUnifoldDepositTrackerAvailable ? (
          <Button
            testID="perps-account-history-deposit-tracker"
            size="small"
            variant="secondary"
            childrenAsText={false}
            borderRadius="$full"
            h={28}
            mr="$3"
            onPress={handleShowUnifoldDepositTracker}
          >
            <Icon
              name="ClockTimeHistoryOutline"
              size="$4"
              mr="$1.5"
              color="$icon"
            />
            <SizableText size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.perp_unifold_crypto_deposits__title,
              })}
            </SizableText>
          </Button>
        ) : null}
      </XStack>
      {/* Absolute panes: out-of-flow content cannot inflate the bounded pane. */}
      <YStack flex={1} position="relative">
        {ORDER_INFO_TABS.map((name) => (
          <Stack
            key={name}
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            display={activeTab === name ? 'flex' : 'none'}
          >
            {renderTabContent(name)}
          </Stack>
        ))}
      </YStack>
    </YStack>
  );
}

export { PerpOrderInfoPanel };
