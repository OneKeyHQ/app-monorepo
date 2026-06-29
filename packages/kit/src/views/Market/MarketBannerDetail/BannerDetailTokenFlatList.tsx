import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import { ListEndIndicator, SizableText, Stack } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TokenListItem } from '../MarketHomeV2/components/MarketTokenList/components/TokenListItem';
import { TokenListSkeleton } from '../MarketHomeV2/components/MarketTokenList/components/TokenListSkeleton';

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

  const sortedData = useMemo(() => {
    if (changeSortType) {
      return data.toSorted((a, b) =>
        changeSortType === 'asc'
          ? a.change24h - b.change24h
          : b.change24h - a.change24h,
      );
    }

    return data;
  }, [changeSortType, data]);

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
          ListFooterComponent={
            sortedData.length > 0 ? <ListEndIndicator /> : null
          }
        />
      )}
    </Stack>
  );
}
