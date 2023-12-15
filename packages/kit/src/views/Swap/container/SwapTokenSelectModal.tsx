import { memo, useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ListItem,
  ListView,
  Page,
  SearchBar,
  Spinner,
} from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import NetworkToggleGroup from '../components/SwapNetworkToggleGroup';
import { useSwapTokenList } from '../hooks/useSwapTokens';

import { withSwapProvider } from './WithSwapProvider';

import type { EModalSwapRoutes, IModalSwapParamList } from '../router/Routers';
import type { ISwapNetwork, ISwapToken } from '../types';
import type { RouteProp } from '@react-navigation/core';

const SwapTokenSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const { type } = route.params;
  const [swapNetworks] = useSwapNetworksAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { selectFromToken, selectToToken } = useSwapActions();
  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >(() =>
    type === 'from'
      ? swapNetworks.find(
          (item: ISwapNetwork) => item.networkId === fromToken?.networkId,
        )
      : swapNetworks.find(
          (item: ISwapNetwork) => item.networkId === toToken?.networkId,
        ),
  );
  const { fetchLoading, fetchTokens, currentTokens } = useSwapTokenList(
    type,
    currentSelectNetwork?.networkId,
  );
  const onSubmitSearchKeyWord = useCallback(
    async (keyword: string) => {
      void fetchTokens({ networkId: currentSelectNetwork?.networkId, keyword });
    },
    [currentSelectNetwork?.networkId, fetchTokens],
  );

  const onSelectToken = useCallback(
    async (item: ISwapToken) => {
      if (type === 'from') {
        void selectFromToken(item);
      } else {
        void selectToToken(item);
      }
      navigation.popStack();
    },
    [navigation, selectFromToken, selectToToken, type],
  );

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
      <SearchBar
        height="$12"
        onSubmitEditing={(e) => {
          void onSubmitSearchKeyWord(e.nativeEvent.text);
        }}
      />
      <NetworkToggleGroup
        networks={swapNetworks}
        selectedNetwork={currentSelectNetwork}
        onSelectNetwork={setCurrentSelectNetwork}
      />
      {fetchLoading ? (
        <Spinner flex={1} justifyContent="center" alignItems="center" />
      ) : (
        <ListView
          data={currentTokens}
          renderItem={renderItem}
          estimatedItemSize="$10"
        />
      )}
    </Page>
  );
};

export default memo(withSwapProvider(SwapTokenSelectModal));
