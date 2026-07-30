import { type ReactNode, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Icon,
  ScrollView,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { normalizeUnifoldIconUrl } from './unifoldFormat';

function MobileSourceSelectorSkeletonList() {
  return (
    <YStack testID="perps-unifold-source-selector-loading">
      {[...Array(6)].map((_, index) => (
        <XStack
          // The index is stable because these placeholders never reorder.
          key={index}
          mx="$-2"
          px="$2"
          width="100%"
          alignItems="center"
          gap="$3"
          py="$2.5"
        >
          <Skeleton radius="round" w="$10" h="$10" />
          <YStack flex={1} gap="$1">
            <Skeleton h="$4" w="$24" />
            <Skeleton h="$3" w="$16" />
          </YStack>
          <Stack width="$5" />
        </XStack>
      ))}
    </YStack>
  );
}

function MobileSourceSelectorRow({
  testID,
  iconUri,
  label,
  description,
  selected,
  onPress,
}: {
  testID: string;
  iconUri?: string;
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={testID}
      mx="$-2"
      px="$2"
      borderRadius="$4"
      cursor="pointer"
      userSelect="none"
      hoverStyle={platformEnv.isNative ? undefined : { bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <XStack width="100%" alignItems="center" gap="$3" py="$2.5">
        <Token tokenImageUri={normalizeUnifoldIconUrl(iconUri)} size="md" />
        <YStack flex={1} minWidth={0}>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {label}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {description}
          </SizableText>
        </YStack>
        {selected ? (
          <Icon name="CheckRadioSolid" size="$5" color="$iconActive" />
        ) : (
          <Stack width="$5" />
        )}
      </XStack>
    </XStack>
  );
}

export function MobileUnifoldSourceSelectorContent({
  mode,
  assets,
  loading = false,
  selectedAssetSymbol,
  selectedChainType,
  selectedChainId,
  onSelectToken,
  onSelectChain,
}: {
  mode: 'token' | 'chain';
  assets: IUnifoldSupportedAsset[] | undefined;
  loading?: boolean;
  selectedAssetSymbol?: string;
  selectedChainType?: string;
  selectedChainId?: string;
  onSelectToken: (asset: IUnifoldSupportedAsset) => void;
  onSelectChain: (
    asset: IUnifoldSupportedAsset,
    chain: IUnifoldSupportedAssetChain,
  ) => void;
}) {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const usableAssets = useMemo(
    () => (assets ?? []).filter((asset) => asset.chains.length > 0),
    [assets],
  );
  const filteredAssets = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) {
      return usableAssets;
    }
    return usableAssets.filter((asset) =>
      [asset.symbol, asset.name].some((field) =>
        field.toLowerCase().includes(keyword),
      ),
    );
  }, [searchValue, usableAssets]);
  const selectedAsset = useMemo(
    () =>
      usableAssets.find((asset) => asset.symbol === selectedAssetSymbol) ??
      usableAssets[0],
    [selectedAssetSymbol, usableAssets],
  );
  const chainOptions = useMemo(
    () => selectedAsset?.chains ?? [],
    [selectedAsset],
  );
  const filteredChains = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) {
      return chainOptions;
    }
    return chainOptions.filter((chain) =>
      [chain.chain_name, chain.chain_type, chain.chain_id].some((field) =>
        field.toLowerCase().includes(keyword),
      ),
    );
  }, [chainOptions, searchValue]);
  let optionRows: ReactNode = null;
  if (mode === 'token') {
    optionRows = filteredAssets.map((asset) => (
      <MobileSourceSelectorRow
        key={asset.symbol}
        testID={`perps-unifold-token-option-${asset.symbol}`}
        iconUri={asset.icon_url}
        label={asset.symbol}
        description={
          asset.chains.length === 1
            ? `1 ${intl.formatMessage({
                id: ETranslations.global_network,
              })}`
            : intl.formatMessage(
                { id: ETranslations.global_count_networks },
                { count: asset.chains.length },
              )
        }
        selected={asset.symbol === selectedAssetSymbol}
        onPress={() => {
          onSelectToken(asset);
        }}
      />
    ));
  } else if (selectedAsset) {
    optionRows = filteredChains.map((chain) => (
      <MobileSourceSelectorRow
        key={`${chain.chain_type}-${chain.chain_id}`}
        testID={`perps-unifold-network-option-${chain.chain_type}-${chain.chain_id}`}
        iconUri={chain.icon_url}
        label={chain.chain_name}
        description={`${intl.formatMessage({
          id: ETranslations.perp_unifold_minimum_deposit__title,
        })} $${chain.minimum_deposit_amount_usd ?? 3}`}
        selected={
          chain.chain_type === selectedChainType &&
          chain.chain_id === selectedChainId
        }
        onPress={() => {
          onSelectChain(selectedAsset, chain);
        }}
      />
    ));
  }
  const hasResults =
    mode === 'token' ? filteredAssets.length > 0 : filteredChains.length > 0;
  let listContent: ReactNode = (
    <YStack py="$10">
      <Empty
        illustration="TwoBlocks"
        title={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
      />
    </YStack>
  );
  if (loading) {
    listContent = <MobileSourceSelectorSkeletonList />;
  } else if (hasResults) {
    listContent = optionRows;
  }

  return (
    <YStack px="$4" flex={1} minHeight={0}>
      <YStack pb="$3">
        <SearchBar
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder={intl.formatMessage({
            id:
              mode === 'token'
                ? ETranslations.global_search_tokens
                : ETranslations.form_search_network_placeholder,
          })}
          containerProps={{
            bg: '$bgStrong',
            borderRadius: '$full',
          }}
        />
      </YStack>
      <Stack flex={1} minHeight={0} mx="$-2">
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack px="$2">{listContent}</YStack>
        </ScrollView>
      </Stack>
    </YStack>
  );
}
