import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

import { AssetItem } from '../../../AssetDetails/pages/HistoryDetails';

import type { RouteProp } from '@react-navigation/core';

const LimitOrderDetailModal = () => {
  //   const navigation =
  //     useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.LimitOrderDetail>
    >();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { orderId, orderItem } = route.params ?? {};
  const [{ swapLimitOrders }] = useInAppNotificationAtom();
  const [orderItemState, setOrderItemState] = useState(orderItem);
  const limitOrderUpdate = useMemo(
    () => swapLimitOrders?.find((item) => item.orderId === orderId),
    [swapLimitOrders, orderId],
  );
  useEffect(() => {
    if (JSON.stringify(limitOrderUpdate) !== JSON.stringify(orderItemState)) {
      setOrderItemState(limitOrderUpdate);
    }
  }, [limitOrderUpdate, orderItem, orderItemState]);

  const renderLimitOrderAssets = useCallback(() => {
    const fromAsset = {
      name: orderItemState?.fromTokenInfo.name ?? '',
      symbol: orderItemState?.fromTokenInfo.symbol ?? '',
      icon: orderItemState?.fromTokenInfo.logoURI ?? '',
      isNFT: false,
      isNative: !!orderItemState?.fromTokenInfo.isNative,
      price: orderItemState?.fromTokenInfo?.price ?? '0',
    };

    const toAsset = {
      name: orderItemState?.toTokenInfo.name ?? '',
      symbol: orderItemState?.toTokenInfo.symbol ?? '',
      icon: orderItemState?.toTokenInfo.logoURI ?? '',
      isNFT: false,
      isNative: !!orderItemState?.toTokenInfo.isNative,
      price: orderItemState?.toTokenInfo?.price ?? '0',
    };
    const fromTokenAmount = orderItemState?.fromAmount;
    return (
      <>
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.IN}
          asset={toAsset}
          isAllNetworks
          amount={orderItemState?.toAmount ?? '0'}
          networkIcon={
            getPresetNetworks().find(
              (item) => item.id === orderItemState?.toTokenInfo?.networkId,
            )?.logoURI ?? ''
          }
          currencySymbol={
            orderItemState?.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
        <AssetItem
          index={1}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          isAllNetworks
          amount={fromTokenAmount ?? '0'}
          networkIcon={
            getPresetNetworks().find(
              (item) => item.id === orderItemState?.fromTokenInfo?.networkId,
            )?.logoURI ?? ''
          }
          currencySymbol={
            orderItemState?.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
      </>
    );
  }, [
    orderItemState?.currency,
    orderItemState?.fromAmount,
    orderItemState?.fromTokenInfo.isNative,
    orderItemState?.fromTokenInfo.logoURI,
    orderItemState?.fromTokenInfo.name,
    orderItemState?.fromTokenInfo?.networkId,
    orderItemState?.fromTokenInfo?.price,
    orderItemState?.fromTokenInfo.symbol,
    orderItemState?.toAmount,
    orderItemState?.toTokenInfo.isNative,
    orderItemState?.toTokenInfo.logoURI,
    orderItemState?.toTokenInfo.name,
    orderItemState?.toTokenInfo?.networkId,
    orderItemState?.toTokenInfo?.price,
    orderItemState?.toTokenInfo.symbol,
    settingsPersistAtom.currencyInfo.symbol,
  ]);

  const renderLimitOrderDetails = useCallback(
    () => <>{renderLimitOrderAssets()}</>,
    [renderLimitOrderAssets],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="Order detail" />
      <Page.Body>{renderLimitOrderDetails()}</Page.Body>
    </Page>
  );
};

export default LimitOrderDetailModal;
