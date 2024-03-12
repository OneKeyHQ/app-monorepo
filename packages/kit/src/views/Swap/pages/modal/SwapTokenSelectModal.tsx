import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Image,
  ListView,
  Page,
  SearchBar,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { ITokenListItemProps } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
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
import {
  swapNetworksCommonCount,
  swapNetworksCommonCountMD,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapDirectionType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import NetworkToggleGroup from '../../components/SwapNetworkToggleGroup';
import { useSwapTokenList } from '../../hooks/useSwapTokens';
import { EModalSwapRoutes } from '../../router/types';
import { getShortAddress } from '../../utils/utils';
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
    () => route.params?.type ?? ESwapDirectionType.FROM,
    [route.params?.type],
  );
  const intl = useIntl();
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
    type === ESwapDirectionType.FROM
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
      if (type === ESwapDirectionType.FROM) {
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
      if (type === ESwapDirectionType.FROM && network.networkId !== 'all') {
        void updateSelectedAccount({
          num: 0,
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
      const tokenItem: ITokenListItemProps = {
        tokenImageSrc: item.logoURI,
        tokenName: item.name,
        tokenSymbol: item.symbol,
        tokenContrastAddress: getShortAddress(item.contractAddress),
        networkImageSrc: item.networkLogoURI,
        balance: item.balanceParsed,
        value: item.fiatValue
          ? `${settingsPersistAtom.currencyInfo.symbol}${item.fiatValue}`
          : undefined,
        onPress: () => onSelectToken(item),
      };
      return <TokenListItem {...tokenItem} />;
    },
    [onSelectToken, settingsPersistAtom.currencyInfo.symbol],
  );

  const { md } = useMedia();

  const networkFilterData = useMemo(() => {
    let swapNetworksCommon: ISwapNetwork[] = [];
    let swapNetworksMoreCount;
    if (swapNetworks && swapNetworks.length) {
      if (md) {
        swapNetworksCommon =
          swapNetworks.length > swapNetworksCommonCountMD
            ? swapNetworks.slice(0, swapNetworksCommonCountMD)
            : swapNetworks;
        swapNetworksMoreCount =
          swapNetworks.length - swapNetworksCommonCountMD > 0
            ? swapNetworks.length - swapNetworksCommonCountMD
            : undefined;
      } else {
        swapNetworksCommon =
          swapNetworks.length > swapNetworksCommonCount
            ? swapNetworks.slice(0, swapNetworksCommonCount)
            : swapNetworks;
        swapNetworksMoreCount =
          swapNetworks.length - swapNetworksCommonCount > 0
            ? swapNetworks.length - swapNetworksCommonCount
            : undefined;
      }
    }
    return {
      swapNetworksCommon,
      swapNetworksMoreCount,
    };
  }, [md, swapNetworks]);

  return (
    <Page>
      <Page.Body px="$4">
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
        <YStack my="$4">
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
            networks={networkFilterData.swapNetworksCommon}
            moreNetworksCount={networkFilterData.swapNetworksMoreCount}
            selectedNetwork={currentSelectNetwork}
            onSelectNetwork={onSelectCurrentNetwork}
          />
        </YStack>
        <XStack mb="$1">
          <SizableText size="$headingSm" mr="$1">
            {`${intl.formatMessage({ id: 'network__network' })}:`}
          </SizableText>
          <XStack>
            {currentSelectNetwork?.networkId !== 'all' ? (
              <Image height="$5" width="$5" borderRadius="$full">
                <Image.Source
                  source={{
                    uri: currentSelectNetwork?.logoURI,
                  }}
                />
              </Image>
            ) : null}
            <SizableText size="$bodyMd" pl="$2">
              {currentSelectNetwork?.name ??
                currentSelectNetwork?.symbol ??
                currentSelectNetwork?.shortcode ??
                'Unknown'}
            </SizableText>
          </XStack>
        </XStack>
        {fetchLoading ? (
          <Spinner flex={1} justifyContent="center" alignItems="center" />
        ) : (
          <YStack flex={1}>
            <ListView
              data={currentTokens}
              renderItem={renderItem}
              estimatedItemSize={60}
            />
          </YStack>
        )}
      </Page.Body>
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
