import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ListEndIndicator,
  NumberSizeableText,
  SizableText,
  Spinner,
  Stack,
  Tabs,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MarketTestIDs } from '../../../testIDs';
import { getMarketNativeCompactListStyle } from '../../layouts/mobileLayoutUtils';
import { TokenListSkeleton } from '../MarketTokenList/components/TokenListSkeleton';
import { PriceChangeBadge } from '../PriceChangeBadge';

import { useMarketStockList } from './hooks/useMarketStockList';
import { useToMarketStockDetailPage } from './hooks/useToMarketStockDetailPage';
import { parseMarketStockNumber } from './utils';

import type { FlatListProps } from 'react-native';

const EMPTY_DATA: IMarketStockPublicItem[] = [];

type IMobileMarketStockFlatListProps = {
  selectedCategoryId: string;
  listContainerProps: {
    paddingBottom: number;
  };
  shouldSuppressItemPress?: () => boolean;
};

function MobileMarketStockFlatListImpl({
  selectedCategoryId,
  listContainerProps,
  shouldSuppressItemPress,
}: IMobileMarketStockFlatListProps) {
  const intl = useIntl();
  const toMarketStockDetailPage = useToMarketStockDetailPage();
  const {
    items,
    isLoading,
    isLoadingMore,
    isError,
    isLoadMoreError,
    canLoadMore,
    loadMore,
    refresh,
  } = useMarketStockList({
    category: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
  });

  const renderItem: FlatListProps<IMarketStockPublicItem>['renderItem'] =
    useCallback(
      ({ item }) => {
        const price = parseMarketStockNumber(item.price);
        const priceChange = parseMarketStockNumber(item.priceChange24hPercent);
        return (
          <XStack
            testID={MarketTestIDs.stockRow(item.stockId)}
            minHeight={72}
            px="$5"
            py="$3"
            alignItems="center"
            borderRadius="$3"
            pressStyle={{ bg: '$bgActive' }}
            onPress={() => {
              if (!shouldSuppressItemPress?.()) {
                void toMarketStockDetailPage(item.stockId);
              }
            }}
          >
            <XStack flex={1} minWidth={0} alignItems="center" gap="$3.5">
              <Token
                size="lg"
                borderRadius="$full"
                tokenImageUri={item.logoUrl}
                fallbackIcon="CryptoCoinOutline"
              />
              <YStack flex={1} minWidth={0}>
                <SizableText size="$bodyLgMedium" numberOfLines={1}>
                  {item.symbol}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </SizableText>
              </YStack>
            </XStack>
            <XStack alignItems="center" gap="$2">
              {price === undefined ? (
                <SizableText
                  size="$bodyLgMedium"
                  color="$textSubdued"
                  flexShrink={1}
                  numberOfLines={1}
                >
                  --
                </SizableText>
              ) : (
                <NumberSizeableText
                  size="$bodyLgMedium"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                  flexShrink={1}
                  numberOfLines={1}
                >
                  {price}
                </NumberSizeableText>
              )}
              <PriceChangeBadge change={priceChange ?? '--'} />
            </XStack>
          </XStack>
        );
      },
      [shouldSuppressItemPress, toMarketStockDetailPage],
    );

  const handleEndReached = useCallback(() => {
    if (canLoadMore && !isLoadingMore && !isLoadMoreError) {
      void loadMore();
    }
  }, [canLoadMore, isLoadMoreError, isLoadingMore, loadMore]);

  const ListFooterComponent = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }
    if (isLoadMoreError) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Button
            testID="market-stock-mobile-load-more-retry"
            size="small"
            variant="tertiary"
            onPress={() => void loadMore()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </Stack>
      );
    }
    if (!canLoadMore && items.length > 0) {
      return <ListEndIndicator />;
    }
    return null;
  }, [
    canLoadMore,
    intl,
    isLoadMoreError,
    isLoadingMore,
    items.length,
    loadMore,
  ]);

  const showSkeleton = isLoading && items.length === 0;
  const ListEmptyComponent = useMemo(
    () =>
      showSkeleton ? (
        <TokenListSkeleton count={10} />
      ) : (
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          p="$8"
          gap="$3"
        >
          <SizableText size="$bodyLg" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_no_data })}
          </SizableText>
          {isError ? (
            <Button
              testID="market-stock-mobile-retry"
              size="small"
              variant="tertiary"
              onPress={() => void refresh()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          ) : null}
        </Stack>
      ),
    [intl, isError, refresh, showSkeleton],
  );

  const tabBarHeight = useScrollContentTabBarOffset();
  return (
    <Tabs.FlatList<IMarketStockPublicItem>
      testID={MarketTestIDs.stockList}
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : items}
      renderItem={renderItem}
      keyExtractor={(item) => item.stockId}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.2}
      initialNumToRender={10}
      maxToRenderPerBatch={20}
      windowSize={platformEnv.isNativeAndroid ? 7 : 3}
      removeClippedSubviews={platformEnv.isNativeIOS}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        ...(platformEnv.isNative
          ? getMarketNativeCompactListStyle(false)
          : { paddingTop: 4 }),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketStockFlatList = memo(MobileMarketStockFlatListImpl);
