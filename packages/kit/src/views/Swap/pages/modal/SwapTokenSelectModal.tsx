import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ActionList,
  Alert,
  Divider,
  Empty,
  ListView,
  Page,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITokenListItemProps } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  swapNetworksCommonCount,
  swapNetworksCommonCountMD,
  swapPopularTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
  ETokenRiskLevel,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import useConfigurableChainSelector from '../../../ChainSelector/hooks/useChainSelector';
import NetworkToggleGroup from '../../components/SwapNetworkToggleGroup';
import SwapPopularTokenGroup from '../../components/SwapPopularTokenGroup';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapTokenList } from '../../hooks/useSwapTokens';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';
import type { FlatList } from 'react-native';

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
  const searchKeywordDebounce = useDebounce(searchKeyword, 500);
  const [swapAllSupportNetworks] = useSwapNetworksIncludeAllNetworkAtom();
  const [swapNetworksIncludeAllNetwork] =
    useSwapNetworksIncludeAllNetworkAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [toToken] = useSwapSelectToTokenAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { selectFromToken, selectToToken, syncNetworksSort } =
    useSwapActions().current;
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const syncDefaultNetworkSelect = useCallback(() => {
    if (type === ESwapDirectionType.FROM) {
      if (fromToken?.networkId) {
        return (
          swapNetworksIncludeAllNetwork.find(
            (item: ISwapNetwork) => item.networkId === fromToken.networkId,
          ) ?? swapNetworksIncludeAllNetwork?.[0]
        );
      }
      if (toToken?.networkId && swapTypeSwitch === ESwapTabSwitchType.SWAP) {
        return (
          swapNetworksIncludeAllNetwork.find(
            (item: ISwapNetwork) => item.networkId === toToken.networkId,
          ) ?? swapNetworksIncludeAllNetwork?.[0]
        );
      }
    } else {
      if (toToken?.networkId) {
        return (
          swapNetworksIncludeAllNetwork.find(
            (item: ISwapNetwork) => item.networkId === toToken.networkId,
          ) ?? swapNetworksIncludeAllNetwork?.[0]
        );
      }
      if (fromToken?.networkId && swapTypeSwitch === ESwapTabSwitchType.SWAP) {
        return (
          swapNetworksIncludeAllNetwork.find(
            (item: ISwapNetwork) => item.networkId === fromToken.networkId,
          ) ?? swapNetworksIncludeAllNetwork?.[0]
        );
      }
    }
    return swapNetworksIncludeAllNetwork?.[0];
  }, [
    fromToken?.networkId,
    swapNetworksIncludeAllNetwork,
    swapTypeSwitch,
    toToken?.networkId,
    type,
  ]);
  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >(syncDefaultNetworkSelect);
  const listViewRef = useRef<FlatList>(null);

  useEffect(() => {
    const accountNet =
      type === ESwapDirectionType.FROM
        ? swapFromAddressInfo.networkId
        : swapToAddressInfo.networkId;
    if (
      currentSelectNetwork?.networkId &&
      currentSelectNetwork?.networkId !== accountNet
    ) {
      void updateSelectedAccountNetwork({
        num: type === ESwapDirectionType.FROM ? 0 : 1,
        networkId: currentSelectNetwork?.networkId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fetchLoading, currentTokens } = useSwapTokenList(
    type,
    currentSelectNetwork?.networkId,
    searchKeywordDebounce,
  );
  const alertIndex = useMemo(
    () =>
      currentTokens.findIndex((item) => {
        const rawItem = (item as IFuseResult<ISwapToken>).item
          ? (item as IFuseResult<ISwapToken>).item
          : (item as ISwapToken);
        return !rawItem.price || new BigNumber(rawItem.price).isZero();
      }),
    [currentTokens],
  );

  const checkRiskToken = useCallback(
    async (token: ISwapToken) => {
      const isRiskLevel =
        !token.isPopular &&
        (!token.price ||
          new BigNumber(token.price).isZero() ||
          token.riskLevel === ETokenRiskLevel.SPAM ||
          token.riskLevel === ETokenRiskLevel.MALICIOUS);
      if (isRiskLevel) {
        if (!settingsPersistAtom.tokenRiskReminder) return false;
        const checkConfirmRiskToken =
          await backgroundApiProxy.serviceSetting.checkConfirmedRiskToken(
            `${token.networkId}_${token.contractAddress}`,
          );
        return !checkConfirmRiskToken;
      }
      return isRiskLevel;
    },
    [settingsPersistAtom.tokenRiskReminder],
  );

  const selectTokenHandler = useCallback(
    (token: ISwapToken) => {
      navigation.popStack();
      if (type === ESwapDirectionType.FROM) {
        void selectFromToken(token);
      } else {
        void selectToToken(token);
      }
    },
    [navigation, selectFromToken, selectToToken, type],
  );

  const onSelectToken = useCallback(
    async (item: ISwapToken) => {
      if (await checkRiskToken(item)) {
        navigation.push(EModalSwapRoutes.TokenRiskReminder, {
          storeName: route.params.storeName,
          token: item,
          onConfirm: () => {
            selectTokenHandler(item);
          },
        });
      } else {
        selectTokenHandler(item);
      }
    },
    [checkRiskToken, navigation, route.params.storeName, selectTokenHandler],
  );

  const onSelectCurrentNetwork = useCallback((network: ISwapNetwork) => {
    setCurrentSelectNetwork(network);
    listViewRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  }, []);

  const sameTokenDisabled = useCallback(
    (token: ISwapToken) =>
      equalTokenNoCaseSensitive({
        token1: {
          networkId:
            type === ESwapDirectionType.FROM
              ? toToken?.networkId
              : fromToken?.networkId,
          contractAddress:
            type === ESwapDirectionType.FROM
              ? toToken?.contractAddress
              : fromToken?.contractAddress,
        },
        token2: {
          networkId: token.networkId,
          contractAddress: token.contractAddress,
        },
      }),
    [
      fromToken?.contractAddress,
      fromToken?.networkId,
      toToken?.contractAddress,
      toToken?.networkId,
      type,
    ],
  );

  const { md } = useMedia();
  const { copyText } = useClipboard();

  const disableNetworks = useMemo(() => {
    let res: string[] = [];
    const networkIds = swapNetworksIncludeAllNetwork.map(
      (net) => net.networkId,
    );
    if (
      swapTypeSwitch === ESwapTabSwitchType.SWAP &&
      type === ESwapDirectionType.TO &&
      fromToken
    ) {
      res = networkIds.filter((net) => net !== fromToken?.networkId);
    }
    if (
      type === ESwapDirectionType.TO &&
      fromToken &&
      swapTypeSwitch === ESwapTabSwitchType.BRIDGE
    ) {
      res = networkIds.filter((net) => net === fromToken?.networkId);
    }

    if (
      type === ESwapDirectionType.FROM &&
      swapTypeSwitch === ESwapTabSwitchType.BRIDGE &&
      toToken
    ) {
      res = networkIds.filter((net) => net === toToken?.networkId);
    }
    return res;
  }, [fromToken, swapNetworksIncludeAllNetwork, swapTypeSwitch, toToken, type]);
  const renderItem = useCallback(
    ({
      item,
      index,
    }: {
      item: ISwapToken | IFuseResult<ISwapToken>;
      index: number;
    }) => {
      const rawItem = (item as IFuseResult<ISwapToken>).item
        ? (item as IFuseResult<ISwapToken>).item
        : (item as ISwapToken);
      const balanceBN = new BigNumber(rawItem.balanceParsed ?? 0);
      const fiatValueBN = new BigNumber(rawItem.fiatValue ?? 0);
      const contractAddressDisplay = md
        ? accountUtils.shortenAddress({
            address: rawItem.contractAddress,
          })
        : rawItem.contractAddress;
      const tokenItem: ITokenListItemProps = {
        isSearch: !!searchKeywordDebounce,
        tokenImageSrc: rawItem.logoURI,
        tokenName: rawItem.name,
        tokenSymbol: rawItem.symbol,
        networkImageSrc: rawItem.networkLogoURI,
        tokenContrastAddress: searchKeywordDebounce
          ? contractAddressDisplay
          : undefined,
        balance: !balanceBN.isZero() ? rawItem.balanceParsed : undefined,
        valueProps:
          rawItem.fiatValue && !fiatValueBN.isZero()
            ? {
                value: rawItem.fiatValue,
                currency: settingsPersistAtom.currencyInfo.symbol,
              }
            : undefined,
        onPress:
          !sameTokenDisabled(rawItem) &&
          !disableNetworks.includes(rawItem.networkId)
            ? () => onSelectToken(rawItem)
            : undefined,
        disabled:
          sameTokenDisabled(rawItem) ||
          disableNetworks.includes(rawItem.networkId),
        titleMatchStr: (item as IFuseResult<ISwapToken>).matches?.find(
          (v) => v.key === 'symbol',
        ),
      };
      return (
        <>
          {alertIndex === index ? (
            <Stack pt="$3" pb="$2">
              <Alert
                fullBleed
                type="default"
                title={intl.formatMessage({
                  id: ETranslations.token_selector_unverified_token_warning,
                })}
                icon="InfoCircleOutline"
              />
            </Stack>
          ) : null}
          <TokenListItem
            {...tokenItem}
            moreComponent={
              <Stack alignSelf="center">
                <ActionList
                  title={tokenItem.tokenSymbol ?? ''}
                  disabled={rawItem.isNative}
                  renderTrigger={
                    <ListItem.IconButton
                      icon="DotVerSolid"
                      variant="tertiary"
                    />
                  }
                  items={[
                    {
                      icon: 'Copy3Outline',
                      label: intl.formatMessage({
                        id: ETranslations.global_copy_token_contract,
                      }),
                      onPress: () => {
                        copyText(rawItem.contractAddress);
                      },
                      disabled: rawItem.isNative,
                    },
                    {
                      icon: 'OpenOutline',
                      label: intl.formatMessage({
                        id: ETranslations.swap_token_selector_contract_info,
                      }),
                      onPress: async () => {
                        const url =
                          await backgroundApiProxy.serviceExplorer.buildExplorerUrl(
                            {
                              networkId: rawItem.networkId,
                              type: 'token',
                              param: rawItem.contractAddress,
                            },
                          );
                        openUrlExternal(url);
                      },
                      disabled: rawItem.isNative,
                    },
                  ]}
                />
              </Stack>
            }
          />
        </>
      );
    },
    [
      alertIndex,
      copyText,
      disableNetworks,
      intl,
      md,
      onSelectToken,
      sameTokenDisabled,
      searchKeywordDebounce,
      settingsPersistAtom.currencyInfo.symbol,
    ],
  );

  const disableMoreNetworks = useMemo(() => {
    let res = false;
    const liveNetworksCount =
      swapNetworksIncludeAllNetwork.length - disableNetworks.length;
    if (md) {
      if (liveNetworksCount <= swapNetworksCommonCountMD) {
        res = true;
      }
    } else if (liveNetworksCount <= swapNetworksCommonCount) {
      res = true;
    }
    return res;
  }, [disableNetworks.length, md, swapNetworksIncludeAllNetwork.length]);

  const networkFilterData = useMemo(() => {
    let swapNetworksCommon: ISwapNetwork[] = [];
    let swapNetworksMoreCount;
    if (swapNetworksIncludeAllNetwork && swapNetworksIncludeAllNetwork.length) {
      if (md) {
        swapNetworksCommon =
          swapNetworksIncludeAllNetwork.length > swapNetworksCommonCountMD
            ? swapNetworksIncludeAllNetwork.slice(0, swapNetworksCommonCountMD)
            : swapNetworksIncludeAllNetwork;
        swapNetworksMoreCount =
          swapNetworksIncludeAllNetwork.length - swapNetworksCommonCountMD > 0
            ? swapNetworksIncludeAllNetwork.length - swapNetworksCommonCountMD
            : undefined;
      } else {
        swapNetworksCommon =
          swapNetworksIncludeAllNetwork.length > swapNetworksCommonCount
            ? swapNetworksIncludeAllNetwork.slice(0, swapNetworksCommonCount)
            : swapNetworksIncludeAllNetwork;
        swapNetworksMoreCount =
          swapNetworksIncludeAllNetwork.length - swapNetworksCommonCount > 0
            ? swapNetworksIncludeAllNetwork.length - swapNetworksCommonCount
            : undefined;
      }
    }
    return {
      swapNetworksCommon,
      swapNetworksMoreCount,
    };
  }, [md, swapNetworksIncludeAllNetwork]);

  const openChainSelector = useConfigurableChainSelector();
  const { bottom } = useSafeAreaInsets();
  const currentNetworkPopularTokens = useMemo(
    () =>
      currentSelectNetwork?.networkId
        ? swapPopularTokens[currentSelectNetwork?.networkId] ?? []
        : [],
    [currentSelectNetwork?.networkId],
  );
  return (
    <Page skipLoading={platformEnv.isNativeIOS} safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.token_selector_title })}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.token_selector_search_placeholder,
          }),
          onChangeText: ({ nativeEvent }) => {
            const afterTrim = nativeEvent.text.trim();
            setSearchKeyword(afterTrim);
          },
        }}
      />
      <Page.Body>
        <XStack px="$5" pb="$2">
          <SizableText size="$bodyMd" color="$textSubdued" pr="$2">
            {`${intl.formatMessage({
              id: ETranslations.token_selector_network,
            })}`}
          </SizableText>
          <XStack>
            <SizableText size="$bodyMd">
              {currentSelectNetwork?.isAllNetworks
                ? intl.formatMessage({ id: ETranslations.global_all_networks })
                : currentSelectNetwork?.name}
            </SizableText>
          </XStack>
        </XStack>
        <NetworkToggleGroup
          onMoreNetwork={() => {
            openChainSelector({
              defaultNetworkId: currentSelectNetwork?.networkId,
              networkIds: swapAllSupportNetworks
                .filter((item) => !item.isAllNetworks)
                .filter((item) => !disableNetworks.includes(item.networkId))
                .map((item) => item.networkId),
              grouped: false,
              onSelect: (network) => {
                if (!network) return;
                const findSwapNetwork = swapAllSupportNetworks.find(
                  (net) => net.networkId === network.id,
                );
                if (!findSwapNetwork) return;
                onSelectCurrentNetwork(findSwapNetwork);
                void syncNetworksSort(findSwapNetwork.networkId);
              },
            });
          }}
          networks={networkFilterData.swapNetworksCommon}
          moreNetworksCount={networkFilterData.swapNetworksMoreCount}
          selectedNetwork={currentSelectNetwork}
          disableNetworks={disableNetworks}
          disableMoreNetworks={disableMoreNetworks}
          onSelectNetwork={onSelectCurrentNetwork}
        />
        {currentNetworkPopularTokens.length > 0 && !searchKeywordDebounce ? (
          <Divider mt="$2" />
        ) : null}
        <YStack flex={1}>
          <ListView
            ref={listViewRef}
            data={currentTokens}
            renderItem={renderItem}
            estimatedItemSize={60}
            ListHeaderComponent={
              currentNetworkPopularTokens.length > 0 &&
              !searchKeywordDebounce ? (
                <YStack px="$5" pt="$3" gap="$2">
                  <SizableText size="$bodyMd" color="$textSubdued" pr="$2">
                    {`${intl.formatMessage({
                      id: ETranslations.swap_token_selector_popular_token,
                    })}`}
                  </SizableText>
                  <SwapPopularTokenGroup
                    onSelectToken={onSelectToken}
                    selectedToken={
                      type === ESwapDirectionType.FROM ? toToken : fromToken
                    }
                    tokens={currentNetworkPopularTokens}
                  />
                </YStack>
              ) : null
            }
            ListFooterComponent={<Stack h={bottom || '$2'} />}
            ListEmptyComponent={
              fetchLoading ? (
                <>
                  {Array.from({ length: 5 }).map((_, index) => (
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
                  ))}
                </>
              ) : (
                <Empty
                  icon="SearchOutline"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_results,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.token_no_search_results_desc,
                  })}
                />
              )
            }
          />
        </YStack>
      </Page.Body>
    </Page>
  );
};

const SwapTokenSelectPageWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapTokenSelectPage />
    </SwapProviderMirror>
  );
};
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
