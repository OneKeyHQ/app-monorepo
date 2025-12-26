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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapTabSwitchType,
  type IFetchLimitOrderRes,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { ETabName, TabBarItem } from '../../../Perp/layouts/PerpMobileLayout';

import LimitOrderList from './LimitOrderList';
import SwapMarketHistoryList from './SwapMarketHistoryList';
import SwapProCurrentSymbolEnable from './SwapProCurrentSymbolEnable';
import SwapProPositionsList from './SwapProPositionsList';

interface ISwapProTabListContainerProps {
  onTokenPress: (token: ISwapToken) => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  onSearchClick?: () => void;
}

const SwapProTabListContainer = memo(
  ({
    onTokenPress,
    onOpenOrdersClick,
    onSearchClick,
  }: ISwapProTabListContainerProps) => {
    const [activeTab, setActiveTab] = useState<ETabName | string>(
      ETabName.Positions,
    );
    const [swapProTokenSelect] = useSwapProSelectTokenAtom();
    const [swapFromToken] = useSwapSelectFromTokenAtom();
    const [swapCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
    const [swapTypeSwitch] = useSwapTypeSwitchAtom();
    const [swapToToken] = useSwapSelectToTokenAtom();
    const focusSwapPro = useMemo(() => {
      return (
        platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT
      );
    }, [swapTypeSwitch]);
    const filterToken = useMemo(() => {
      if (focusSwapPro) {
        return swapProTokenSelect ? [swapProTokenSelect] : [];
      }
      return [swapFromToken, swapToToken].filter((t) => t !== undefined);
    }, [focusSwapPro, swapFromToken, swapToToken, swapProTokenSelect]);
    const openOrdersTabName = useMemo(() => {
      return focusSwapPro
        ? ETabName.SwapProOpenOrders
        : ETabName.SwapOrderHistory;
    }, [focusSwapPro]);

    const changeTabToLimitOrderList = useCallback(() => {
      setActiveTab(openOrdersTabName);
    }, [setActiveTab, openOrdersTabName]);

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
    }, [changeTabToLimitOrderList, openOrdersTabName]);

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
              onPress={setActiveTab}
            />
            <TabBarItem
              name={openOrdersTabName}
              isFocused={activeTab === openOrdersTabName}
              onPress={setActiveTab}
            />
          </XStack>
        </XStack>
        <YStack flex={1}>
          <YStack
            display={activeTab === ETabName.Positions ? 'flex' : 'none'}
            flex={1}
          >
            <SwapProCurrentSymbolEnable isFocusSwapPro={focusSwapPro} />
            <SwapProPositionsList
              onTokenPress={onTokenPress}
              onSearchClick={onSearchClick}
              filterToken={swapCurrentSymbolEnable ? filterToken : undefined}
            />
          </YStack>
          <YStack
            display={activeTab === openOrdersTabName ? 'flex' : 'none'}
            flex={1}
          >
            <SwapProCurrentSymbolEnable isFocusSwapPro={focusSwapPro} />
            {focusSwapPro ? (
              <LimitOrderList
                onClickCell={onOpenOrdersClick}
                type="open"
                filterToken={swapCurrentSymbolEnable ? filterToken : undefined}
              />
            ) : (
              <XStack mx="$-6">
                <SwapMarketHistoryList
                  showType={
                    swapTypeSwitch === ESwapTabSwitchType.SWAP
                      ? 'swap'
                      : 'bridge'
                  }
                  filterToken={
                    swapCurrentSymbolEnable ? filterToken : undefined
                  }
                  isPushModal
                />
              </XStack>
            )}
          </YStack>
        </YStack>
      </YStack>
    );
  },
);

SwapProTabListContainer.displayName = 'SwapProTabListContainer';

export default SwapProTabListContainer;
