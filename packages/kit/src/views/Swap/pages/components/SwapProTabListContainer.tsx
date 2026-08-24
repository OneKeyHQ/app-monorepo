import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { XStack, YStack } from '@onekeyhq/components';
import {
  useSwapProEnableCurrentSymbolAtom,
  useSwapProSelectTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import {
  ESwapProAnalyticsTab,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchLimitOrderRes,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { ETabName, TabBarItem } from '../../../Perp/layouts/PerpMobileLayout';
import { useSwapProSupportNetworksTokenList } from '../../hooks/useSwapPro';

import LimitOrderList from './LimitOrderList';
import SwapHistoryClearButton from './SwapHistoryClearButton';
import SwapMarketHistoryList from './SwapMarketHistoryList';
import SwapProCurrentSymbolEnable from './SwapProCurrentSymbolEnable';
import SwapProPositionsList from './SwapProPositionsList';

interface ISwapProTabListContainerProps {
  onTokenPress: (token: ISwapToken) => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  onSearchClick?: () => void;
  supportNetworksList: (IMarketBasicConfigNetwork | ISwapNetwork)[];
  supportNetworksReady: boolean;
}

function getSwapProAnalyticsTab(tab: ETabName | string) {
  if (tab === ETabName.Positions) {
    return ESwapProAnalyticsTab.POSITIONS;
  }
  if (tab === ETabName.SwapProOpenOrders) {
    return ESwapProAnalyticsTab.OPEN_ORDERS;
  }
  if (tab === ETabName.SwapOrderHistory) {
    return ESwapProAnalyticsTab.ORDER_HISTORY;
  }
  return undefined;
}

const SwapProTabListContainer = memo(
  ({
    onTokenPress,
    onOpenOrdersClick,
    onSearchClick,
    supportNetworksList,
    supportNetworksReady,
  }: ISwapProTabListContainerProps) => {
    const [activeTab, setActiveTab] = useState<ETabName | string>(
      ETabName.Positions,
    );
    const [swapProTokenSelect] = useSwapProSelectTokenAtom();
    const [swapFromToken] = useSwapSelectFromTokenAtom();
    const [swapCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
    const [swapTypeSwitch] = useSwapTypeSwitchAtom();
    const [swapToToken] = useSwapSelectToTokenAtom();
    const {
      cachedPositionTokenList,
      hasCachedPositionSnapshot,
      hasPositionOwner,
      isLiveTokenListForCurrentOwner,
    } = useSwapProSupportNetworksTokenList(
      supportNetworksList,
      supportNetworksReady,
    );
    const focusSwapPro = useMemo(() => {
      return (
        platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT
      );
    }, [swapTypeSwitch]);
    const filterToken = useMemo(() => {
      if (!swapCurrentSymbolEnable) {
        return undefined;
      }
      if (focusSwapPro) {
        return swapProTokenSelect ? [swapProTokenSelect] : [];
      }
      return [swapFromToken, swapToToken].filter((t) => t !== undefined);
    }, [
      swapCurrentSymbolEnable,
      focusSwapPro,
      swapFromToken,
      swapToToken,
      swapProTokenSelect,
    ]);
    const handleTabPress = useCallback(
      (tab: ETabName) => {
        if (activeTab === tab) {
          return;
        }
        setActiveTab(tab);
        if (!focusSwapPro) {
          return;
        }
        const fromTab = getSwapProAnalyticsTab(activeTab);
        const toTab = getSwapProAnalyticsTab(tab);
        if (fromTab && toTab) {
          defaultLogger.swap.swapPro.swapProTabSwitch({
            fromTab,
            toTab,
          });
        }
      },
      [activeTab, focusSwapPro],
    );

    const changeTabToLimitOrderList = useCallback(() => {
      setActiveTab(ETabName.SwapProOpenOrders);
    }, [setActiveTab]);

    // The Open orders tab only exists in limit (Pro) mode; if the mode switches
    // away while it is active, fall back to Positions so a valid tab stays shown.
    useEffect(() => {
      if (!focusSwapPro && activeTab === ETabName.SwapProOpenOrders) {
        setActiveTab(ETabName.Positions);
      }
    }, [focusSwapPro, activeTab, setActiveTab]);

    useEffect(() => {
      appEventBus.off(
        EAppEventBusNames.SwapLimitOrderBuildSuccess,
        changeTabToLimitOrderList,
      );
      appEventBus.on(
        EAppEventBusNames.SwapLimitOrderBuildSuccess,
        changeTabToLimitOrderList,
      );
      return () => {
        appEventBus.off(
          EAppEventBusNames.SwapLimitOrderBuildSuccess,
          changeTabToLimitOrderList,
        );
      };
    }, [changeTabToLimitOrderList]);

    return (
      <YStack>
        <XStack
          bg="$bgApp"
          borderBottomWidth="$0.5"
          borderBottomColor="$borderSubdued"
          justifyContent="space-between"
          alignItems="center"
        >
          <XStack gap="$5" bg="$bgApp">
            <TabBarItem
              name={ETabName.Positions}
              isFocused={activeTab === ETabName.Positions}
              onPress={handleTabPress}
            />
            {focusSwapPro ? (
              <TabBarItem
                name={ETabName.SwapProOpenOrders}
                isFocused={activeTab === ETabName.SwapProOpenOrders}
                onPress={handleTabPress}
              />
            ) : null}
            <TabBarItem
              name={ETabName.SwapOrderHistory}
              isFocused={activeTab === ETabName.SwapOrderHistory}
              onPress={handleTabPress}
            />
          </XStack>
        </XStack>
        <YStack flex={1}>
          <YStack
            display={activeTab === ETabName.Positions ? 'flex' : 'none'}
            flex={1}
          >
            <SwapProCurrentSymbolEnable
              analyticsTab={
                focusSwapPro ? ESwapProAnalyticsTab.POSITIONS : undefined
              }
            />
            <SwapProPositionsList
              onTokenPress={onTokenPress}
              onSearchClick={onSearchClick}
              filterToken={filterToken}
              cachedTokenList={cachedPositionTokenList}
              hasPositionOwner={hasPositionOwner}
              hasCachedTokenSnapshot={hasCachedPositionSnapshot}
              isLiveTokenListForCurrentOwner={isLiveTokenListForCurrentOwner}
            />
          </YStack>
          {focusSwapPro ? (
            <YStack
              display={
                activeTab === ETabName.SwapProOpenOrders ? 'flex' : 'none'
              }
              flex={1}
            >
              <SwapProCurrentSymbolEnable
                analyticsTab={ESwapProAnalyticsTab.OPEN_ORDERS}
              />
              {activeTab === ETabName.SwapProOpenOrders ? (
                <LimitOrderList
                  onClickCell={onOpenOrdersClick}
                  type="open"
                  filterToken={filterToken}
                />
              ) : null}
            </YStack>
          ) : null}
          <YStack
            display={activeTab === ETabName.SwapOrderHistory ? 'flex' : 'none'}
            flex={1}
          >
            {/* Order history is not scoped to the current token: no
                "Current tokens" toggle here, and the list shows every order
                regardless of the shared current-symbol filter. Swap & Bridge
                and Pro share this surface, so they clear the same (non-stock)
                dataset. */}
            {activeTab === ETabName.SwapOrderHistory ? (
              <XStack mx="$-6">
                <SwapMarketHistoryList
                  isPushModal
                  firstSectionRightAction={
                    <SwapHistoryClearButton
                      scope="swap"
                      triggerVariant="icon"
                    />
                  }
                />
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      </YStack>
    );
  },
);

SwapProTabListContainer.displayName = 'SwapProTabListContainer';

export default SwapProTabListContainer;
