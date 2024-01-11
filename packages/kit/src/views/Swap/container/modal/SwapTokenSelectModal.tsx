import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ListView,
  Page,
  SearchBar,
  SizableText,
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
import SwapTokenSelectCell from '../../components/SwapTokenSelectCell';
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
    () => route.params?.type ?? 'from',
    [route.params?.type],
  );
  const [searchKeyword, setSearchKeyword] = useState<string>('');
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
        ) ?? swapNetworks?.[0]
      : swapNetworks.find(
          (item: ISwapNetwork) =>
            item.networkId === toToken?.networkId ||
            item.networkId === onlySupportSingleNetWork,
        ) ?? swapNetworks?.[0],
  );
  const { fetchLoading, currentTokens } = useSwapTokenList(
    type,
    currentSelectNetwork?.networkId,
    searchKeyword,
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
    ({ item }: { item: ISwapToken }) => {
      const tokenNetwork = swapNetworks.find(
        (network) => network.networkId === item.networkId,
      );
      return (
        <SwapTokenSelectCell
          isSearch={!!searchKeyword}
          tokenNetwork={tokenNetwork}
          selectNetwork={currentSelectNetwork}
          token={item}
          onSelectToken={onSelectToken}
        />
      );
    },
    [currentSelectNetwork, onSelectToken, searchKeyword, swapNetworks],
  );

  return (
    <Page>
      <SearchBar
        h="$12"
        w="100%"
        value={searchKeyword}
        clearTextOnFocus
        onChangeText={(text) => {
          const afterTrim = text.trim();
          setSearchKeyword(afterTrim);
        }}
      />
      <YStack h="$12" my="$4">
        <SizableText>{`Select Network:${
          currentSelectNetwork?.name ?? ''
        }`}</SizableText>
        <NetworkToggleGroup
          type={type}
          onMoreNetwork={() => {
            setSearchKeyword('');
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapNetworkSelect,
              params: { setCurrentSelectNetwork },
            });
          }}
          onlySupportSingleNetWork={onlySupportSingleNetWork}
          networks={swapNetworks.slice(0, 3)}
          selectedNetwork={currentSelectNetwork}
          onSelectNetwork={(network) => {
            setSearchKeyword('');
            setCurrentSelectNetwork(network);
          }}
        />
      </YStack>

      {fetchLoading ? (
        <Spinner flex={1} justifyContent="center" alignItems="center" />
      ) : (
        <YStack flex={1}>
          <ListView
            data={currentTokens}
            ListHeaderComponent={<SizableText>SelectToken</SizableText>}
            renderItem={renderItem}
            estimatedItemSize="$10"
          />
        </YStack>
      )}
    </Page>
  );
};

export default memo(withSwapProvider(SwapTokenSelectModal));
