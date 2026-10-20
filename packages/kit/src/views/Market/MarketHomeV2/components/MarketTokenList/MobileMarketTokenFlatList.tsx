import { memo, useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ListEndIndicator,
  SizableText,
  Spinner,
  Stack,
  Tabs,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { prewarmMarketTokenImages } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload';
import { preloadMarketDetailV2Page } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getMarketNativeCompactListStyle } from '../../layouts/mobileLayoutUtils';
import { buildTokenMarketRow } from '../MarketNativeList/marketNativeListRows';
import { WebMarketCompactList } from '../MarketNativeList/WebMarketCompactList';

import { TokenListItem } from './components/TokenListItem';
import { TokenListSkeleton } from './components/TokenListSkeleton';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useToDetailPage } from './hooks/useToMarketDetailPage';
import { shouldUseStockMetadataColumnsForTokens } from './utils/tokenListHelpers';

import type { IMarketToken } from './MarketTokenData';
import type { IMarketTimeRangeValue } from '../../types';
import type { FlatListProps } from 'react-native';

interface IMobileMarketTokenFlatListProps {
  networkId: string;
  selectedCategory?: string;
  stockCategory?: string;
  hasCompactHeader?: boolean;
  timeRange?: IMarketTimeRangeValue;
  listContainerProps: {
    paddingBottom: number;
  };
  onStockDataChange?: (categoryId: string, isStockData: boolean) => void;
  shouldSuppressItemPress?: () => boolean;
}

const EMPTY_DATA: IMarketToken[] = [];

function MobileMarketTokenFlatListBase({
  networkId,
  selectedCategory,
  stockCategory,
  hasCompactHeader = false,
  timeRange,
  listContainerProps,
  onStockDataChange,
  shouldSuppressItemPress,
}: IMobileMarketTokenFlatListProps) {
  const intl = useIntl();
  const toMarketDetailPage = useToDetailPage({
    marketTokenCategory: selectedCategory,
  });

  // Data management
  const {
    data,
    isLoading,
    isLoadingMore,
    isLoadMoreError,
    isError,
    isNetworkSwitching,
    isProvisionalFirstPageResult,
    canLoadMore,
    loadMore,
    refetch,
  } = useMarketTokenList({
    networkId,
    useApiDefaultSort: true,
    pageSize: 20,
    type: selectedCategory,
    category: stockCategory,
    timeRange,
  });

  const isStockData = useMemo(
    () => shouldUseStockMetadataColumnsForTokens(data),
    [data],
  );

  useEffect(() => {
    if (selectedCategory) {
      onStockDataChange?.(selectedCategory, isStockData);
    }
  }, [isStockData, onStockDataChange, selectedCategory]);

  // Render item callback
  const renderItem: FlatListProps<IMarketToken>['renderItem'] = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <TokenListItem
        item={item}
        onPress={() => {
          if (shouldSuppressItemPress?.()) {
            return;
          }
          void toMarketDetailPage({
            ...item,
            symbol: item.symbol,
            tokenAddress: item.address,
            networkId: item.networkId,
            isNative: item.isNative,
          });
        }}
      />
    ),
    [shouldSuppressItemPress, toMarketDetailPage],
  );

  // Key extractor - must be unique across different networks
  const keyExtractor = useCallback(
    (item: IMarketToken) => `${item.address}-${item.symbol}-${item.networkId}`,
    [],
  );

  // Handle infinite scroll
  const handleEndReached = useCallback(() => {
    if (
      canLoadMore &&
      !isLoadingMore &&
      (platformEnv.isNative || !isLoadMoreError) &&
      !isProvisionalFirstPageResult
    ) {
      void loadMore();
      return true;
    }
    return false;
  }, [
    canLoadMore,
    isLoadingMore,
    isLoadMoreError,
    isProvisionalFirstPageResult,
    loadMore,
  ]);

  // List footer - loading spinner or end indicator
  const ListFooterComponent = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }

    if (!platformEnv.isNative && isLoadMoreError) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Button
            testID="market-token-mobile-load-more-retry"
            size="small"
            variant="tertiary"
            onPress={() => void loadMore()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </Stack>
      );
    }

    if (!isProvisionalFirstPageResult && !canLoadMore && data.length > 0) {
      return <ListEndIndicator />;
    }

    return null;
  }, [
    isLoadingMore,
    isLoadMoreError,
    isProvisionalFirstPageResult,
    canLoadMore,
    data.length,
    intl,
    loadMore,
  ]);

  const showSkeleton =
    (Boolean(isLoading) && data.length === 0) || Boolean(isNetworkSwitching);

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return <TokenListSkeleton count={10} />;
    }

    return (
      <Stack
        flex={1}
        alignItems="center"
        justifyContent="center"
        p="$8"
        gap="$3"
      >
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_no_data,
          })}
        </SizableText>
        {isError ? (
          <Button
            testID="market-token-mobile-retry"
            size="small"
            variant="tertiary"
            onPress={() => void refetch()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        ) : null}
      </Stack>
    );
  }, [showSkeleton, intl, isError, refetch]);

  const tabBarHeight = useScrollContentTabBarOffset();
  const handleWebItemPress = useCallback(
    (item: IMarketToken) => {
      if (shouldSuppressItemPress?.()) return;
      void toMarketDetailPage({
        ...item,
        symbol: item.symbol,
        tokenAddress: item.address,
        networkId: item.networkId,
        isNative: item.isNative,
      });
    },
    [shouldSuppressItemPress, toMarketDetailPage],
  );
  const handleWebPressIn = useCallback((item: IMarketToken) => {
    void preloadMarketDetailV2Page({
      includeBodyModules: true,
      includeHeavyModules: true,
      isStockRoute: Boolean(resolveMarketStockId(item)),
      layout: 'mobile',
    });
    prewarmMarketTokenImages(item);
  }, []);
  if (!platformEnv.isNative)
    return (
      <WebMarketCompactList
        data={showSkeleton ? EMPTY_DATA : data}
        buildRow={buildTokenMarketRow}
        onPress={handleWebItemPress}
        onPressIn={handleWebPressIn}
        onEndReached={handleEndReached}
        empty={ListEmptyComponent}
        footer={ListFooterComponent}
        contentPaddingBottom={tabBarHeight}
      />
    );
  return (
    <Tabs.FlatList<IMarketToken>
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.2}
      // Performance optimizations to improve page switching speed
      initialNumToRender={10}
      maxToRenderPerBatch={20}
      windowSize={platformEnv.isNativeAndroid ? 7 : 3}
      removeClippedSubviews={platformEnv.isNativeIOS}
      updateCellsBatchingPeriod={platformEnv.isNativeAndroid ? 50 : 100}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        ...(platformEnv.isNative
          ? getMarketNativeCompactListStyle(hasCompactHeader)
          : { paddingTop: 4 }),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketTokenFlatList = memo(MobileMarketTokenFlatListBase);
