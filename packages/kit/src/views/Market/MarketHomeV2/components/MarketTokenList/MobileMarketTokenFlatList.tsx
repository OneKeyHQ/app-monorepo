import { memo, useCallback, useMemo } from 'react';

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

import { MarketFilterBarSmall } from '../MarketFilterBarSmall';
import { TokenListItem } from './components/TokenListItem';
import { TokenListSkeleton } from './components/TokenListSkeleton';
import { useMarketTokenList } from './hooks/useMarketTokenList';
import { useToDetailPage } from './hooks/useToMarketDetailPage';
import type { IMarketToken } from './MarketTokenData';

import type { ITimeRangeSelectorValue } from '../../components/TimeRangeSelector';
import type { FlatListProps } from 'react-native';

interface IMobileMarketTokenFlatListProps {
  networkId: string;
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
  };
  listContainerProps: {
    paddingBottom: number;
  };
}

const EMPTY_DATA: IMarketToken[] = [];
function MobileMarketTokenFlatListBase({
  networkId,
  filterBarProps,
  listContainerProps,
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
    initialSortBy: 'v24hUSD', // Default sort by 24h volume
    initialSortType: 'desc',
    pageSize: 20,
  });

  // Render item callback
  const renderItem: FlatListProps<IMarketToken>['renderItem'] = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <TokenListItem
        item={item}
        onPress={() =>
          toMarketDetailPage({
            symbol: item.symbol,
            tokenAddress: item.address,
            networkId: item.networkId,
            isNative: item.isNative,
          })
        }
      />
    ),
    [toMarketDetailPage],
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

  // List header - filter bar
  const ListHeaderComponent = useMemo(
    () => <MarketFilterBarSmall {...filterBarProps} />,
    [filterBarProps],
  );

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

  const loading = isLoading || isNetworkSwitching;
  // List empty - skeleton or empty message
  const ListEmptyComponent = useMemo(() => {
    if (loading) {
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
  }, [loading, intl]);

  // Note: getItemLayout is disabled because dynamic item heights are more accurate
  // If re-enabling, measure actual rendered item height and uncomment below:
  const getItemLayout = useCallback(
    (_: ArrayLike<IMarketToken> | null | undefined, index: number) => ({
      length: 73,
      offset: 73 * index,
      index,
    }),
    [],
  );

  const tabBarHeight = useScrollContentTabBarOffset();
  return (
    <Tabs.FlatList<IMarketToken>
      showsVerticalScrollIndicator={false}
      data={loading ? EMPTY_DATA : data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={handleEndReached}
      getItemLayout={getItemLayout}
      onEndReachedThreshold={0.2}
      // Performance optimizations to improve page switching speed
      initialNumToRender={10}
      maxToRenderPerBatch={20}
      windowSize={3}
      removeClippedSubviews={platformEnv.isNative}
      updateCellsBatchingPeriod={100}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        paddingTop: 8 + (platformEnv.isNative ? 170 : 0),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketTokenFlatList = memo(MobileMarketTokenFlatListBase);
