import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import { SizableText, Stack } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MobileMarketStockListItem } from '../MarketHomeV2/components/MarketStockList/MobileMarketStockListItem';
import { TokenListSkeleton } from '../MarketHomeV2/components/MarketTokenList/components/TokenListSkeleton';
import { sortMarketTokenListData } from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

import { BannerDetailListColumnHeader } from './BannerDetailListColumnHeader';

import type { IBannerDetailSortType } from './BannerDetailListColumnHeader';
import type { FlatListProps } from 'react-native';

type IBannerDetailStockFlatListProps = {
  items: IMarketStockPublicItem[];
  isLoading?: boolean;
  changeSortType?: IBannerDetailSortType;
  onChangeSortPress: () => void;
  onItemPress: (item: IMarketStockPublicItem) => void;
};

// The mobile list for stock banners: the mobile Stocks tab's rows under the
// banner's sortable column header. The change column takes the Stocks tab's
// label: a stock quote's move is per session, not per 24 hours.
export function BannerDetailStockFlatList({
  items,
  isLoading,
  changeSortType,
  onChangeSortPress,
  onItemPress,
}: IBannerDetailStockFlatListProps) {
  const intl = useIntl();
  const tabBarHeight = useTabBarHeight();

  const sortedItems = useMemo(
    () =>
      sortMarketTokenListData({
        data: items,
        field: changeSortType ? 'priceChange24hPercent' : undefined,
        order: changeSortType,
      }),
    [changeSortType, items],
  );

  const renderItem: FlatListProps<IMarketStockPublicItem>['renderItem'] =
    useCallback(
      ({ item }) => (
        <MobileMarketStockListItem item={item} onPress={onItemPress} />
      ),
      [onItemPress],
    );

  const keyExtractor = useCallback(
    (item: IMarketStockPublicItem) => item.stockId,
    [],
  );

  const emptyComponent = useMemo(() => {
    if (isLoading) {
      return null;
    }
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [intl, isLoading]);

  return (
    <Stack flex={1}>
      <BannerDetailListColumnHeader
        primaryColumnTitle={intl.formatMessage({
          id: ETranslations.market_stock_company,
        })}
        changeSortType={changeSortType}
        change24hColumnTitle={intl.formatMessage({
          id: ETranslations.market_stock_change__title,
        })}
        onChangeSortPress={onChangeSortPress}
      />
      {isLoading && sortedItems.length === 0 ? (
        <TokenListSkeleton count={15} />
      ) : (
        <FlatList<IMarketStockPublicItem>
          style={{ flex: 1 }}
          data={sortedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          contentContainerStyle={{ paddingBottom: tabBarHeight }}
          ListEmptyComponent={emptyComponent}
        />
      )}
    </Stack>
  );
}
