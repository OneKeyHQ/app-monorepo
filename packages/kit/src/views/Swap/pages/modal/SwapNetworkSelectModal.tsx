import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import Fuse from 'fuse.js';

import {
  type IPageNavigationProp,
  ListView,
  Page,
  SearchBar,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapActions,
  useSwapNetworksAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { withSwapProvider } from '../WithSwapProvider';

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

  const { syncNetworksSort } = useSwapActions().current;

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
      <Page.Body px="$4">
        <SearchBar
          h="$12"
          w="100%"
          onChangeText={(text) => {
            const afterTrim = text.trim();
            onSearchNetWork(afterTrim);
          }}
        />
        <ListView
          mt="$4"
          estimatedItemSize="$10"
          renderItem={renderItem}
          data={showNetworkList}
        />
      </Page.Body>
    </Page>
  );
};

export default withSwapProvider(SwapNetworkSelectModal);
