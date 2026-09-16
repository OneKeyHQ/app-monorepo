import { memo, useCallback, useMemo } from 'react';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MarketTestIDs } from '../../../testIDs';
import { getMarketNativeCompactListStyle } from '../../layouts/mobileLayoutUtils';
import { TokenListSkeleton } from '../MarketTokenList/components/TokenListSkeleton';

import { useMarketStockList } from './hooks/useMarketStockList';
import { useToMarketStockDetailPage } from './hooks/useToMarketStockDetailPage';
import { MobileMarketStockListItem } from './MobileMarketStockListItem';

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
    isRefreshing,
    isRefreshError,
    canLoadMore,
    isRevalidatingFirstPage,
    loadMore,
    refresh,
  } = useMarketStockList({
    category: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
  });

  const handleItemPress = useCallback(
    (item: IMarketStockPublicItem) => {
      if (!shouldSuppressItemPress?.()) {
        void toMarketStockDetailPage(item);
      }
    },
    [shouldSuppressItemPress, toMarketStockDetailPage],
  );

  const renderItem: FlatListProps<IMarketStockPublicItem>['renderItem'] =
    useCallback(
      ({ item }) => (
        <MobileMarketStockListItem item={item} onPress={handleItemPress} />
      ),
      [handleItemPress],
    );

  const handleEndReached = useCallback(() => {
    if (canLoadMore && !isLoadingMore && !isLoadMoreError && !isRefreshError) {
      void loadMore();
    }
  }, [canLoadMore, isLoadMoreError, isRefreshError, isLoadingMore, loadMore]);

  const ListFooterComponent = useMemo(() => {
    if (isLoadingMore || (isRefreshing && isRefreshError)) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }
    if (isLoadMoreError || isRefreshError) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Button
            testID="market-stock-mobile-load-more-retry"
            size="small"
            variant="tertiary"
            onPress={() => void (isRefreshError ? refresh() : loadMore())}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </Stack>
      );
    }
    if (!canLoadMore && items.length > 0 && !isRevalidatingFirstPage) {
      return <ListEndIndicator />;
    }
    return null;
  }, [
    canLoadMore,
    isRevalidatingFirstPage,
    intl,
    isLoadMoreError,
    isRefreshing,
    isRefreshError,
    refresh,
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
