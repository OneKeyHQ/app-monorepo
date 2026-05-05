import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  ListView,
  NumberSizeableText,
  Page,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  IEarnAssetsList,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';

function formatFiatValue(fiatValue?: string) {
  const fiatValueBN = new BigNumber(fiatValue || '0');
  if (fiatValueBN.isNaN() || fiatValueBN.lte(0)) {
    return '$0.00';
  }
  return `$${fiatValueBN.toFixed(2)}`;
}

function TokenRow({
  item,
  isSelected,
  onPress,
}: {
  item: IEarnTokenItem;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      py="$2"
      px="$3"
      mx="$5"
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
      hoverStyle={isSelected ? undefined : { bg: '$bgHover' }}
      pressStyle={isSelected ? undefined : { bg: '$bgActive' }}
      bg={isSelected ? '$bgHover' : undefined}
      cursor={isSelected ? 'default' : 'pointer'}
      onPress={isSelected ? undefined : onPress}
      borderRadius="$3"
    >
      <XStack flex={1} alignItems="center" gap="$3">
        <Token size="md" tokenImageUri={item.info.logoURI} />
        <YStack>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {item.info.symbol}
          </SizableText>
          {item.info.name ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {item.info.name}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>

      <YStack alignItems="flex-end" flexShrink={0}>
        <NumberSizeableText size="$bodyMd" formatter="balance">
          {item.balanceParsed || '0'}
        </NumberSizeableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {formatFiatValue(item.fiatValue)}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function LoadingSkeleton() {
  return (
    <YStack px="$5" gap="$2">
      {[0, 1, 2].map((i) => (
        <XStack key={i} py="$2" px="$3" alignItems="center" gap="$3">
          <Skeleton w="$10" h="$10" radius="round" />
          <YStack flex={1} gap="$1">
            <Skeleton w="$16" h="$4" />
            <Skeleton w="$12" h="$3" />
          </YStack>
          <YStack alignItems="flex-end" gap="$1">
            <Skeleton w="$16" h="$4" />
            <Skeleton w="$12" h="$3" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

export default function EarnTokenSelectModal() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EarnTokenSelect
  >();
  const {
    networkId,
    accountId,
    provider,
    symbol,
    vault,
    action,
    currentTokenAddress,
    onSelect,
  } = route.params;
  const [searchKeyword, setSearchKeyword] = useState('');

  const { result: assetsList, isLoading } = usePromiseResult<IEarnAssetsList>(
    async () => {
      if (!accountId || !networkId || !provider || !symbol) {
        return { assets: [] };
      }
      return backgroundApiProxy.serviceStaking.getEarnAssetsList({
        accountId,
        networkId,
        provider,
        symbol,
        vault: vault || undefined,
        action,
      });
    },
    [accountId, networkId, provider, symbol, vault, action],
    {
      initResult: { assets: [] },
      watchLoading: true,
    },
  );

  const assets = assetsList.assets;

  const filteredAssets = useMemo(() => {
    const seen = new Set<string>();
    const removeDuplicates = (list: IEarnTokenItem[]) =>
      list.filter((item) => {
        const key = item.info.uniqueKey
          ? item.info.uniqueKey
          : `${item.info.isNative ? 'native' : item.info.address}-${item.info.symbol}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return removeDuplicates(assets);
    return removeDuplicates(
      assets.filter((item) => {
        const sym = item.info.symbol.toLowerCase();
        const name = item.info.name.toLowerCase();
        const addr = (item.info.address ?? '').toLowerCase();
        return (
          sym.includes(keyword) ||
          name.includes(keyword) ||
          addr.includes(keyword)
        );
      }),
    );
  }, [assets, searchKeyword]);

  const handleSelect = useCallback(
    (item: IEarnTokenItem) => {
      onSelect?.(item);
      navigation.pop();
    },
    [navigation, onSelect],
  );

  const getTokenUniqueKey = useCallback((item: IEarnTokenItem) => {
    if (item.info.uniqueKey) return item.info.uniqueKey;
    return `${item.info.isNative ? 'native' : item.info.address}-${item.info.symbol}`;
  }, []);

  const isTokenSelected = useCallback(
    (item: IEarnTokenItem) => {
      if (!currentTokenAddress) return false;
      if (item.info.isNative) return currentTokenAddress === 'native';
      return (
        item.info.address?.toLowerCase() === currentTokenAddress?.toLowerCase()
      );
    },
    [currentTokenAddress],
  );

  const renderItem = useCallback(
    ({ item }: { item: IEarnTokenItem }) => (
      <TokenRow
        item={item}
        isSelected={isTokenSelected(item)}
        onPress={() => handleSelect(item)}
      />
    ),
    [handleSelect, isTokenSelected],
  );

  const keyExtractor = useCallback(
    (item: IEarnTokenItem) => getTokenUniqueKey(item),
    [getTokenUniqueKey],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.token_selector_title,
        })}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.token_selector_search_placeholder,
          }),
          onChangeText: ({ nativeEvent }) => {
            setSearchKeyword(nativeEvent.text);
          },
          searchBarInputValue: searchKeyword,
        }}
      />
      <Page.Body>
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <ListView
            data={filteredAssets}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            estimatedItemSize={60}
            ListEmptyComponent={
              <YStack py="$10" alignItems="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.global_no_results,
                  })}
                </SizableText>
              </YStack>
            }
            ListFooterComponent={<Stack h={bottom || '$2'} />}
          />
        )}
      </Page.Body>
    </Page>
  );
}
