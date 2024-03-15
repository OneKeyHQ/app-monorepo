import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Empty,
  Image,
  ListView,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { ITokenListItemProps } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapOnlySupportSingleChainAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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

import { ListItem } from '../../../../components/ListItem';
import NetworkToggleGroup from '../../components/SwapNetworkToggleGroup';
import { useSwapTokenList } from '../../hooks/useSwapTokens';
import { withSwapProvider } from '../WithSwapProvider';

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
        tokenContrastAddress: accountUtils.shortenAddress({
          address: item.contractAddress,
        }),
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
      <Page.Header
        title="Select Token"
        headerSearchBarOptions={{
          placeholder: 'Search symbol or contract address',
          onChangeText: ({ nativeEvent }) => {
            const afterTrim = nativeEvent.text.trim();
            setSearchKeyword(afterTrim);
          },
        }}
      />
      <Page.Body>
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
        <XStack px="$5" py="$2">
          <SizableText size="$headingSm" pr="$2">
            {`${intl.formatMessage({ id: 'network__network' })}:`}
          </SizableText>
          <XStack>
            {currentSelectNetwork?.networkId !== 'all' ? (
              <Image height="$5" width="$5" borderRadius="$full" mr="$2">
                <Image.Source
                  source={{
                    uri: currentSelectNetwork?.logoURI,
                  }}
                />
              </Image>
            ) : null}
            <SizableText size="$bodyMd">
              {currentSelectNetwork?.name ??
                currentSelectNetwork?.symbol ??
                currentSelectNetwork?.shortcode ??
                'Unknown'}
            </SizableText>
          </XStack>
        </XStack>
        {fetchLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <ListItem key={index}>
              <Skeleton w="$10" h="$10" radius="round" />
              <YStack>
                <YStack py="$1">
                  <Skeleton h="$4" w="$32" />
                </YStack>
                <YStack py="$1">
                  <Skeleton h="$3" w="$24" />
                </YStack>
              </YStack>
            </ListItem>
          ))
        ) : (
          <YStack flex={1}>
            <ListView
              pb="$2"
              data={currentTokens}
              renderItem={renderItem}
              estimatedItemSize={60}
              ListEmptyComponent={
                <Empty
                  icon="SearchOutline"
                  title="No Results"
                  description="The token you searched for was not found"
                />
              }
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
