import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce } from 'lodash';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ListItem,
  ListView,
  Page,
  SearchBar,
  Spinner,
  YStack,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Modal/type';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapOnlySupportSingleChainAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../../states/jotai/contexts/swap';
import NetworkToggleGroup from '../../components/SwapNetworkToggleGroup';
import { useSwapTokenList } from '../../hooks/useSwapTokens';
import { EModalSwapRoutes } from '../../router/Routers';
import { withSwapProvider } from '../WithSwapProvider';

import type { IModalSwapParamList } from '../../router/Routers';
import type { ISwapNetwork, ISwapToken } from '../../types';
import type { RouteProp } from '@react-navigation/core';

const SwapTokenSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const type = useMemo(
    () => route?.params?.type ?? 'from',
    [route?.params?.type],
  );
  const [swapNetworks] = useSwapNetworksAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [onlySupportSingleNetWork] = useSwapOnlySupportSingleChainAtom();
  const { selectFromToken, selectToToken } = useSwapActions();
  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >(() =>
    type === 'from'
      ? swapNetworks.find(
          (item: ISwapNetwork) => item.networkId === fromToken?.networkId,
        )
      : swapNetworks.find(
          (item: ISwapNetwork) =>
            item.networkId === toToken?.networkId ||
            item.networkId === onlySupportSingleNetWork,
        ),
  );
  const { fetchLoading, fetchTokens, currentTokens } = useSwapTokenList(
    type,
    currentSelectNetwork?.networkId,
  );
  const onChangeSearchKeyWord = debounce(
    useCallback(
      async (keyword: string) => {
        console.log('keyword--', keyword);
        void fetchTokens({
          networkId: currentSelectNetwork?.networkId,
          keyword,
        });
      },
      [currentSelectNetwork?.networkId, fetchTokens],
    ),
    500,
  );

  const onSelectToken = useCallback(
    async (item: ISwapToken) => {
      navigation.popStack();
      if (type === 'from') {
        void selectFromToken(item);
      } else {
        void selectToToken(item);
      }
    },
    [navigation, selectFromToken, selectToToken, type],
  );

  const renderItem = useCallback(
    ({ item }: { item: ISwapToken }) => (
      <ListItem
        key={`${item.symbol} - ${item.networkId}`}
        title={`${item.symbol} - ${
          item.contractAddress ? item.contractAddress : 'nativeToken'
        }`}
        subtitle={item.providers}
        avatarProps={{ source: { uri: item.logoURI } }}
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
        h="$12"
        w="100%"
        onChangeText={(text) => {
          void onChangeSearchKeyWord(text);
        }}
      />
      <YStack h="$12" my="$4">
        <NetworkToggleGroup
          type={type}
          onMoreNetwork={() => {
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapNetworkSelect,
              params: { setCurrentSelectNetwork },
            });
          }}
          onlySupportSingleNetWork={onlySupportSingleNetWork}
          networks={swapNetworks.slice(0, 3)}
          selectedNetwork={currentSelectNetwork}
          onSelectNetwork={setCurrentSelectNetwork}
        />
      </YStack>

      {fetchLoading ? (
        <Spinner flex={1} justifyContent="center" alignItems="center" />
      ) : (
        <YStack flex={1}>
          <ListView
            data={currentTokens}
            renderItem={renderItem}
            estimatedItemSize="$10"
          />
        </YStack>
      )}
    </Page>
  );
};

export default memo(withSwapProvider(SwapTokenSelectModal));
