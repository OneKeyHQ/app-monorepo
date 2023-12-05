import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ListItem, ListView, Page, Spinner } from '@onekeyhq/components';
import { type ISwapNetwork } from '@onekeyhq/kit-bg/src/services/ServiceSwap';
import { useSwapAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

import type { EModalSwapRoutes, IModalSwapParamList } from '../types';
import type { RouteProp } from '@react-navigation/core';

export default function SwapNetworkSelectModal() {
  console.log('SwapNetworkSelectModal');
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapNetworkSelect>
    >();
  const { type } = route.params;
  const [swapAtom] = useSwapAtom();
  const [loading, setLoading] = useState(false);

  const onSelectNetwork = useCallback(
    async (item: ISwapNetwork) => {
      await backgroundApiProxy.serviceSwap.selectNetwork(item, type);
      navigation.popStack();
    },
    [navigation, type],
  );

  useEffect(() => {
    if (!swapAtom.fromNetworkList) {
      setLoading(true);
      void backgroundApiProxy.serviceSwap.fetchSwapNetworks().finally(() => {
        setLoading(false);
      });
    }
  }, [swapAtom.fromNetworkList]);

  const renderItem = useCallback(
    ({ item }: { item: ISwapNetwork }) => (
      <ListItem
        key={item.networkId}
        title={item.networkId}
        subtitle={item.providers}
        onPress={() => {
          void onSelectNetwork(item);
        }}
      />
    ),
    [onSelectNetwork],
  );
  return (
    <Page>
      {loading ? (
        <Spinner flex={1} justifyContent="center" alignItems="center" />
      ) : (
        <ListView
          flex={1}
          data={
            type === 'from' ? swapAtom.fromNetworkList : swapAtom.toNetworkList
          }
          renderItem={renderItem}
          estimatedItemSize="$10"
        />
      )}
    </Page>
  );
}
