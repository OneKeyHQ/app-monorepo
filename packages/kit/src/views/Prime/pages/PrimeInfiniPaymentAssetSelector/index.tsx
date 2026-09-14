/* cspell:ignore Infini */
import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  ListView,
  Page,
  SearchBar,
  SizableText,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import NetworkToggleGroup from '@onekeyhq/kit/src/components/NetworkToggleGroup';
import type { INetworkToggleGroupItem } from '@onekeyhq/kit/src/components/NetworkToggleGroup';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { useSpecifiedTokenSelectorBalances } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getListedNetworkMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import type { IPrimeInfiniPaymentAsset } from '@onekeyhq/shared/types/prime/primeTypes';

const listedNetworkMap = getListedNetworkMap();
const ALL_NETWORKS_FILTER_ID = 'prime-infini-all-networks';

export default function PrimeInfiniPaymentAssetSelector() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IAssetSelectorParamList>>();
  const route = useAppRoute<
    IAssetSelectorParamList,
    EAssetSelectorRoutes.PrimeInfiniPaymentAssetSelector
  >();
  const { bottom } = useSafeAreaInsets();
  const {
    assets,
    selectedAssetKey,
    accountId,
    indexedAccountId,
    accountNetworkId,
    onSelect,
  } = route.params;
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedNetworkId, setSelectedNetworkId] = useState(
    () =>
      assets.find((asset) => asset.key === selectedAssetKey)?.networkId ??
      ALL_NETWORKS_FILTER_ID,
  );
  const openChainSelector = useConfigurableChainSelector();

  const supportedNetworks = useMemo<INetworkToggleGroupItem[]>(() => {
    const networkIds = new Set<string>();
    return assets.flatMap((asset) => {
      if (networkIds.has(asset.networkId)) {
        return [];
      }
      networkIds.add(asset.networkId);
      const network = listedNetworkMap[asset.networkId];
      return [
        {
          networkId: asset.networkId,
          name: network?.name ?? asset.chain,
          logoURI: network?.logoURI,
        },
      ];
    });
  }, [assets]);

  const networkFilterItems = useMemo<INetworkToggleGroupItem[]>(
    () => [
      {
        networkId: ALL_NETWORKS_FILTER_ID,
        name: intl.formatMessage({
          id: ETranslations.global_all_networks,
        }),
        isAllNetworks: true,
      },
      ...supportedNetworks,
    ],
    [intl, supportedNetworks],
  );
  const selectedNetwork =
    networkFilterItems.find(
      (network) => network.networkId === selectedNetworkId,
    ) ?? networkFilterItems[0];

  const handleOpenMoreNetworks = useCallback(() => {
    openChainSelector({
      networkIds: supportedNetworks.map((network) => network.networkId),
      grouped: false,
      defaultNetworkId:
        selectedNetworkId === ALL_NETWORKS_FILTER_ID
          ? undefined
          : selectedNetworkId,
      onSelect: (network) => {
        setSelectedNetworkId(network.id);
      },
    });
  }, [openChainSelector, selectedNetworkId, supportedNetworks]);

  const balanceTargets = useMemo(
    () =>
      assets.map((asset) => ({
        key: asset.key,
        networkId: asset.networkId,
        contractAddress: asset.contractAddress,
      })),
    [assets],
  );
  const { balanceStateByKey: assetDisplayStateMap, isLoading } =
    useSpecifiedTokenSelectorBalances({
      accountId,
      networkId: accountNetworkId,
      indexedAccountId,
      targets: balanceTargets,
    });

  const filteredAssets = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return assets.filter(
        (asset) =>
          selectedNetworkId === ALL_NETWORKS_FILTER_ID ||
          asset.networkId === selectedNetworkId,
      );
    }
    return assets.filter((asset) => {
      if (
        selectedNetworkId !== ALL_NETWORKS_FILTER_ID &&
        asset.networkId !== selectedNetworkId
      ) {
        return false;
      }
      const network = listedNetworkMap[asset.networkId];
      const tokenInfo = assetDisplayStateMap?.[asset.key]?.detail?.info;
      return [
        asset.token,
        asset.chain,
        asset.contractAddress,
        tokenInfo?.name,
        tokenInfo?.symbol,
        network?.name,
      ].some((value) => value?.toLowerCase().includes(normalizedKeyword));
    });
  }, [assetDisplayStateMap, assets, searchKeyword, selectedNetworkId]);

  const handleSelectAsset = useCallback(
    (asset: IPrimeInfiniPaymentAsset) => {
      onSelect(asset.key);
      navigation.pop();
    },
    [navigation, onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: IPrimeInfiniPaymentAsset }) => {
      const network = listedNetworkMap[item.networkId];
      const displayState = assetDisplayStateMap?.[item.key];
      const detail = displayState?.detail;
      const hasFiatValue =
        detail?.fiatValue && !new BigNumber(detail.fiatValue).isZero();
      return (
        <TokenListItem
          testID={`prime-infini-asset-option-${item.key}`}
          tokenImageSrc={detail?.info.logoURI}
          networkImageSrc={network?.logoURI}
          tokenSymbol={item.token}
          tokenName={detail?.info.name ?? item.token}
          tokenSymbolAccessory={
            selectedNetworkId === ALL_NETWORKS_FILTER_ID ? (
              <Badge badgeType="default" badgeSize="sm">
                {network?.name ?? item.chain}
              </Badge>
            ) : undefined
          }
          balance={
            displayState?.balanceLoaded
              ? (detail?.balanceParsed ?? '0')
              : undefined
          }
          valueProps={
            hasFiatValue
              ? {
                  value: detail.fiatValue,
                  currency: settings.currencyInfo.symbol,
                }
              : undefined
          }
          isLoading={isLoading}
          bg={item.key === selectedAssetKey ? '$bgStrong' : undefined}
          onPress={() => handleSelectAsset(item)}
        />
      );
    },
    [
      assetDisplayStateMap,
      handleSelectAsset,
      isLoading,
      selectedAssetKey,
      selectedNetworkId,
      settings.currencyInfo.symbol,
    ],
  );

  return (
    <Page testID="prime-infini-asset-selector-page" safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.token_selector_title })}
      />
      <Page.Body>
        <Stack px="$5" pb="$3">
          <SearchBar
            testID="prime-infini-asset-selector-search"
            placeholder={intl.formatMessage({
              id: ETranslations.token_selector_search_placeholder,
            })}
            value={searchKeyword}
            onSearchTextChange={setSearchKeyword}
          />
        </Stack>
        <XStack
          px="$5"
          pb="$2"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
        >
          <XStack alignItems="center" flexShrink={1} h="$8" minWidth={0}>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              pr="$2"
              lineHeight={32}
            >
              {intl.formatMessage({
                id: ETranslations.token_selector_network,
              })}
            </SizableText>
            <SizableText size="$bodyMd" numberOfLines={1} lineHeight={32}>
              {selectedNetwork?.name}
            </SizableText>
          </XStack>
        </XStack>
        <NetworkToggleGroup
          testIDPrefix="prime-infini-network-filter"
          networks={networkFilterItems}
          maxVisibleNetworks={networkFilterItems.length}
          selectedNetwork={selectedNetwork}
          onSelectNetwork={(network) => {
            setSelectedNetworkId(network.networkId);
          }}
          onMoreNetwork={handleOpenMoreNetworks}
        />
        <ListView
          flex={1}
          data={filteredAssets}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          estimatedItemSize={60}
          contentContainerStyle={{ paddingBottom: bottom }}
          ListEmptyComponent={
            <Empty
              illustration="TwoBlocks"
              title={intl.formatMessage({
                id: ETranslations.global_no_results,
              })}
              description={intl.formatMessage({
                id: ETranslations.token_no_search_results_desc,
              })}
            />
          }
        />
      </Page.Body>
    </Page>
  );
}
