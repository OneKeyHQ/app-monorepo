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
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapOnlySupportSingleChainAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import NetworkToggleGroup from '../../components/SwapNetworkToggleGroup';
import SwapTokenSelectCell from '../../components/SwapTokenSelectCell';
import { useSwapTokenList } from '../../hooks/useSwapTokens';
import { EModalSwapRoutes } from '../../router/types';
import SwapAccountAddressContainer from '../components/SwapAccountAddressContainer';
import { withSwapProvider } from '../WithSwapProvider';

import type { IModalSwapParamList } from '../../router/types';
import type { RouteProp } from '@react-navigation/core';

const SwapTokenSelectPage = () => {
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
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [onlySupportSingleNetWork] = useSwapOnlySupportSingleChainAtom();
  const { selectFromToken, selectToToken } = useSwapActions().current;
  const { updateSelectedAccount } = useAccountSelectorActions().current;
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
      if (type === 'from') {
        void selectFromToken(item);
      } else {
        void selectToToken(item);
      }
      navigation.popStack();
    },
    [navigation, selectFromToken, selectToToken, type],
  );

  const onSelectCurrentNetwork = useCallback(
    (network: ISwapNetwork) => {
      if (network.networkId !== 'all') {
        updateSelectedAccount({
          num: type === 'from' ? 0 : 1,
          builder: (v) => ({ ...v, networkId: network.networkId }),
        });
      }
      setSearchKeyword('');
      setCurrentSelectNetwork(network);
    },
    [type, updateSelectedAccount],
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
          currencySymbol={settingsPersistAtom.currencyInfo.symbol}
        />
      );
    },
    [
      currentSelectNetwork,
      onSelectToken,
      searchKeyword,
      settingsPersistAtom.currencyInfo.symbol,
      swapNetworks,
    ],
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
              params: { setCurrentSelectNetwork: onSelectCurrentNetwork },
            });
          }}
          onlySupportSingleNetWork={onlySupportSingleNetWork}
          networks={swapNetworks.slice(0, 3)}
          selectedNetwork={currentSelectNetwork}
          onSelectNetwork={onSelectCurrentNetwork}
        />
      </YStack>
      <SwapAccountAddressContainer num={type === 'from' ? 0 : 1} />
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

const SwapTokenSelectPageWithProvider = memo(
  withSwapProvider(SwapTokenSelectPage),
);
export default function SwapTokenSelectModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <SwapTokenSelectPageWithProvider />
    </AccountSelectorProviderMirror>
  );
}
