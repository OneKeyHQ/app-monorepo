import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ListItem, ListView, Page, Spinner } from '@onekeyhq/components';
import type { ISwapToken } from '@onekeyhq/kit-bg/src/services/ServiceSwap';
import { useSwapAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

import type { EModalSwapRoutes, IModalSwapParamList } from '../types';
import type { RouteProp } from '@react-navigation/core';

export default function SwapTokenSelectModal() {
  console.log('SwapTokenSelectModal');
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const { type } = route.params;
  const [{ fromNetwork, toNetwork, fromTokenList, toTokenList }] =
    useSwapAtom();
  const [loading, setLoading] = useState(false);

  const onSelectToken = useCallback(
    async (item: ISwapToken) => {
      await backgroundApiProxy.serviceSwap.selectToken(item, type);
      navigation.popStack();
    },
    [navigation, type],
  );

  useEffect(() => {
    const currentNetWork = type === 'from' ? fromNetwork : toNetwork;
    const currentTokens = type === 'from' ? fromTokenList : toTokenList;
    if (!currentNetWork || currentTokens) return;
    setLoading(true);
    void backgroundApiProxy.serviceSwap.fetchSwapTokens(type).finally(() => {
      setLoading(false);
    });
  }, [fromNetwork, fromTokenList, toNetwork, toTokenList, type]);
  const renderItem = useCallback(
    ({ item }: { item: ISwapToken }) => (
      <ListItem
        key={item.symbol}
        title={item.symbol}
        subtitle={item.providers}
        onPress={() => {
          void onSelectToken(item);
        }}
      />
    ),
    [onSelectToken],
  );

  return (
    <Page>
      {loading ? (
        <Spinner flex={1} justifyContent="center" alignItems="center" />
      ) : (
        <ListView
          flex={1}
          data={type === 'from' ? fromTokenList : toTokenList}
          renderItem={renderItem}
          estimatedItemSize="$10"
        />
      )}
    </Page>
  );
}
