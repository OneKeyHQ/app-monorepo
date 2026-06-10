import { memo, useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ListEndIndicator,
  SizableText,
  Spinner,
  Stack,
  Tabs,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  timeRange,
  listContainerProps,
  onStockDataChange,
  shouldSuppressItemPress,
}: IMobileMarketTokenFlatListProps) {
  const intl = useIntl();
  const toMarketDetailPage = useToDetailPage();

  // Data management
  const {
    data,
    isLoading,
    isLoadingMore,
    isNetworkSwitching,
    canLoadMore,
    loadMore,
  } = useMarketTokenList({
    networkId,
    initialSortBy: 'v24hUSD',
    initialSortType: 'desc',
    pageSize: 20,
    type: selectedCategory,
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
            symbol: item.symbol,
            tokenAddress: item.address,
            networkId: item.networkId,
            isNative: item.isNative,
            decimals: item.decimals,
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
    if (canLoadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  // List footer - loading spinner or end indicator
  const ListFooterComponent = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }

    if (!canLoadMore && data.length > 0) {
      return <ListEndIndicator />;
    }

    return null;
  }, [isLoadingMore, canLoadMore, data.length]);

  const showSkeleton =
    (Boolean(isLoading) && data.length === 0) || Boolean(isNetworkSwitching);

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return <TokenListSkeleton count={10} />;
    }

    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_no_data,
          })}
        </SizableText>
      </Stack>
    );
  }, [showSkeleton, intl]);

  const tabBarHeight = useScrollContentTabBarOffset();
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
        ...(platformEnv.isNative ? {} : { paddingTop: 4 }),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketTokenFlatList = memo(MobileMarketTokenFlatListBase);
