import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { Skeleton, XStack, YStack } from '@onekeyhq/components';
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
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
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
  disableDelayRender?: boolean;
}

function SwapProTabListSkeleton() {
  return (
    <YStack gap="$2" minHeight={118} p="$2">
      <XStack>
        <Skeleton w="$20" h="$8" radius="round" />
      </XStack>
      <XStack justifyContent="space-between">
        <Skeleton w="$20" h="$5" radius="round" />
        <Skeleton w="$10" h="$5" radius="round" />
      </XStack>
      <XStack justifyContent="space-between">
        <Skeleton w="$24" h="$5" radius="round" />
        <Skeleton w="$12" h="$5" radius="round" />
      </XStack>
    </YStack>
  );
}

const SwapProTabListContainer = memo(
  ({
    onTokenPress,
    onOpenOrdersClick,
    onSearchClick,
    supportNetworksList,
    disableDelayRender = false,
  }: ISwapProTabListContainerProps) => {
    const [activeTab, setActiveTab] = useState<ETabName | string>(
      ETabName.Positions,
    );
    const [swapProTokenSelect] = useSwapProSelectTokenAtom();
    const [swapFromToken] = useSwapSelectFromTokenAtom();
    const [swapCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
    const [swapTypeSwitch] = useSwapTypeSwitchAtom();
    const [swapToToken] = useSwapSelectToTokenAtom();
    const [shouldRenderLists, setShouldRenderLists] = useState(false);

    const { cachedPositionTokenList, hasCachedPositionTokenList } =
      useSwapProSupportNetworksTokenList(supportNetworksList);
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
    const shouldRenderListContent = shouldRenderLists || disableDelayRender;
    const shouldRenderPositionsContent =
      shouldRenderListContent || hasCachedPositionTokenList;

    const changeTabToLimitOrderList = useCallback(() => {
      setActiveTab(ETabName.SwapProOpenOrders);
    }, [setActiveTab]);

    // The Open orders tab only exists in limit (Pro) mode; if the mode switches
    // away while it is active, fall back to Positions so a valid tab stays shown.
    useEffect(() => {
      if (!focusSwapPro && activeTab === ETabName.SwapProOpenOrders) {
        setActiveTab(ETabName.Positions);
      }
    }, [focusSwapPro, activeTab]);

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

    // Delay rendering heavy list components after initial render
    useEffect(() => {
      const timer = setTimeout(() => {
        setShouldRenderLists(true);
      }, 200);
      return () => {
        clearTimeout(timer);
      };
    }, []);

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
            {focusSwapPro ? (
              <TabBarItem
                name={ETabName.SwapProOpenOrders}
                isFocused={activeTab === ETabName.SwapProOpenOrders}
                onPress={setActiveTab}
              />
            ) : null}
            <TabBarItem
              name={ETabName.SwapOrderHistory}
              isFocused={activeTab === ETabName.SwapOrderHistory}
              onPress={setActiveTab}
            />
          </XStack>
        </XStack>
        <YStack flex={1}>
          <YStack
            display={activeTab === ETabName.Positions ? 'flex' : 'none'}
            flex={1}
          >
            <SwapProCurrentSymbolEnable />
            {shouldRenderPositionsContent ? (
              <SwapProPositionsList
                onTokenPress={onTokenPress}
                onSearchClick={onSearchClick}
                filterToken={filterToken}
                cachedTokenList={cachedPositionTokenList}
                hasCachedTokenList={hasCachedPositionTokenList}
              />
            ) : (
              <SwapProTabListSkeleton />
            )}
          </YStack>
          {focusSwapPro ? (
            <YStack
              display={
                activeTab === ETabName.SwapProOpenOrders ? 'flex' : 'none'
              }
              flex={1}
            >
              <SwapProCurrentSymbolEnable />
              {shouldRenderListContent ? (
                <LimitOrderList
                  onClickCell={onOpenOrdersClick}
                  type="open"
                  filterToken={filterToken}
                />
              ) : (
                <SwapProTabListSkeleton />
              )}
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
            {shouldRenderListContent ? (
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
            ) : (
              <SwapProTabListSkeleton />
            )}
          </YStack>
        </YStack>
      </YStack>
    );
  },
);

SwapProTabListContainer.displayName = 'SwapProTabListContainer';

export default SwapProTabListContainer;
