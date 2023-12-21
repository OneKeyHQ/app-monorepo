import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import Fuse from 'fuse.js';

import {
  type IPageNavigationProp,
  ListItem,
  ListView,
  Page,
  SearchBar,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import {
  useSwapActions,
  useSwapNetworksAtom,
} from '../../../../states/jotai/contexts/swap';
import { withSwapProvider } from '../WithSwapProvider';

import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '../../router/Routers';
import type { ISwapNetwork } from '../../types';
import type { RouteProp } from '@react-navigation/core';

const SwapNetworkSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapNetworkSelect>
    >();

  const [networkList] = useSwapNetworksAtom();

  const setCurrentSelectNetwork = route?.params?.setCurrentSelectNetwork;

  const { syncNetworksSort } = useSwapActions();

  const renderItem = useCallback(
    ({ item }: { item: ISwapNetwork }) => (
      <ListItem
        key={item.networkId}
        title={`${item.name ?? item.symbol ?? item.shortcode ?? ''}`}
        subtitle={`${item.protocol}`}
        avatarProps={{ source: { uri: item.logoURI } }}
        onPress={() => {
          void syncNetworksSort(item.networkId);
          navigation.pop();
          setCurrentSelectNetwork?.(item);
        }}
      />
    ),
    [navigation, setCurrentSelectNetwork, syncNetworksSort],
  );

  const noAllNetworkList = useMemo(
    () => networkList.filter((item) => item.networkId !== 'all'),
    [networkList],
  );

  const [showNetworkList, setShowNetworkList] = useState<ISwapNetwork[]>(
    () => noAllNetworkList,
  );
  const searchFuse = useMemo(
    () => new Fuse(noAllNetworkList, { keys: ['name', 'symbol', 'shortcode'] }),
    [noAllNetworkList],
  );
  const onSearchNetWork = useCallback(
    (keyword: string) => {
      if (keyword === '') {
        setShowNetworkList(noAllNetworkList);
      } else {
        const searchRes = searchFuse.search(keyword);
        setShowNetworkList(searchRes.map((item) => item.item));
      }
    },
    [noAllNetworkList, searchFuse],
  );
  return (
    <Page>
      <SearchBar
        h="$12"
        w="100%"
        onChangeText={(text) => {
          onSearchNetWork(text);
        }}
      />
      <ListView
        estimatedItemSize="$10"
        renderItem={renderItem}
        data={showNetworkList}
      />
    </Page>
  );
};

export default withSwapProvider(SwapNetworkSelectModal);
