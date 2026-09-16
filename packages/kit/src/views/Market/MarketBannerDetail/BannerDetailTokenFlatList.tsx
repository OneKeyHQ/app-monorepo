import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import { SizableText, Stack } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TokenListItem } from '../MarketHomeV2/components/MarketTokenList/components/TokenListItem';
import { TokenListSkeleton } from '../MarketHomeV2/components/MarketTokenList/components/TokenListSkeleton';
import { sortMarketTokenListData } from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

import { BannerDetailListColumnHeader } from './BannerDetailListColumnHeader';

import type { IBannerDetailSortType } from './BannerDetailListColumnHeader';
import type { IMarketToken } from '../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { FlatListProps } from 'react-native';

type IBannerDetailTokenFlatListProps = {
  data: IMarketToken[];
  isLoading?: boolean;
  changeSortType?: IBannerDetailSortType;
  change24hColumnTitle: string;
  onChangeSortPress: () => void;
  onItemPress: (item: IMarketToken) => void;
};

// The mobile list for token banners: the mobile Trending tab's rows under the
// banner's sortable column header.
export function BannerDetailTokenFlatList({
  data,
  isLoading,
  changeSortType,
  change24hColumnTitle,
  onChangeSortPress,
  onItemPress,
}: IBannerDetailTokenFlatListProps) {
  const intl = useIntl();
  const tabBarHeight = useTabBarHeight();

  const sortedData = useMemo(
    () =>
      sortMarketTokenListData({
        data,
        field: changeSortType ? 'change24h' : undefined,
        order: changeSortType,
      }),
    [changeSortType, data],
  );

  const renderItem: FlatListProps<IMarketToken>['renderItem'] = useCallback(
    ({ item }) => (
      <TokenListItem item={item} onPress={() => onItemPress(item)} />
    ),
    [onItemPress],
  );

  const keyExtractor = useCallback((item: IMarketToken) => item.id, []);

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
        // Same label as the mobile home lists: the row's second line is the
        // token's volume.
        primaryColumnTitle={`${intl.formatMessage({
          id: ETranslations.global_name,
        })} / ${intl.formatMessage({
          id: ETranslations.market_stock_volume__title,
        })}`}
        changeSortType={changeSortType}
        change24hColumnTitle={change24hColumnTitle}
        onChangeSortPress={onChangeSortPress}
      />
      {isLoading && sortedData.length === 0 ? (
        <TokenListSkeleton count={15} />
      ) : (
        <FlatList<IMarketToken>
          style={{ flex: 1 }}
          data={sortedData}
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
