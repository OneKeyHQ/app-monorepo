import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Divider,
  Empty,
  FlatList,
  Button,
  ScrollView,
  Spinner,
} from '@onekeyhq/components/src';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';

import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import {
  MARKET_FAVORITES_CATEGORYID,
  MarketCategory,
} from '../../store/reducers/market';

import MarketCategoryToggles from './Components/MarketList/MarketCategoryToggles';
import MarketListHeader from './Components/MarketList/MarketListHeader';
import MarketRecomment from './Components/MarketList/MarketRecomment';
import MarketTokenCell from './Components/MarketList/MarketTokenCell';
import { ListHeadTags } from './config';
import {
  useMarketCategoryList,
  useMarketFavoriteCategoryTokenIds,
  useMarketFavoriteRecommentedList,
} from './hooks/useMarketCategory';
import { useMarketList } from './hooks/useMarketList';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showMarketCellMoreMenu } from './Components/MarketList/MarketCellMoreMenu';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const MarketList: FC = () => {
  const isVerticalLayout = useIsVerticalLayout();
  const categorys: MarketCategory[] = useMarketCategoryList();
  const recommendedTokens = useMarketFavoriteRecommentedList();
  const favoriteTokens = useMarketFavoriteCategoryTokenIds();
  const { selectedCategory } = useMarketList();
  const listHeadTags = isVerticalLayout
    ? ListHeadTags.filter((t) => t.isVerticalLayout)
    : ListHeadTags;
  const navigation = useNavigation<NavigationProps>();
  const renderItem: ListRenderItem<string> = useCallback(
    ({ item }) => (
      <MarketTokenCell
        marketTokenId={item}
        headTags={listHeadTags}
        onPress={() => {
          // goto detail
          navigation.navigate(HomeRoutes.MarketDetail, { marketTokenId: item });
        }}
        onLongPress={(marketTokenItem) => {
          showMarketCellMoreMenu(marketTokenItem, {
            header: `${marketTokenItem.symbol ?? marketTokenItem.name ?? ''}`,
          });
        }}
      />
    ),
    [listHeadTags, navigation],
  );

  return (
    <Box flex={1}>
      <ScrollView mt={6} p={4} bg="background-default">
        {!selectedCategory ? (
          <Center flex={1}>
            <Spinner size="lg" />
          </Center>
        ) : (
          <>
            <MarketCategoryToggles categorys={categorys} />
            {selectedCategory.categoryId === MARKET_FAVORITES_CATEGORYID &&
            favoriteTokens.length === 0 &&
            recommendedTokens.length > 0 ? (
              <MarketRecomment tokens={recommendedTokens} />
            ) : (
              <FlatList
                data={selectedCategory.coingeckoIds}
                renderItem={renderItem}
                ListHeaderComponent={() => (
                  <MarketListHeader headTags={listHeadTags} />
                )}
                ItemSeparatorComponent={Divider}
                ListEmptyComponent={
                  <Center flex={1}>
                    <Empty
                      isLoading
                      emoji={
                        selectedCategory.categoryId ===
                        MARKET_FAVORITES_CATEGORYID
                          ? '⭐️'
                          : '⌛'
                      }
                      title={`No ${selectedCategory.name ?? ''} Token`}
                      subTitle={`${
                        selectedCategory.name ?? ''
                      } tokens will show here.`}
                    />
                  </Center>
                }
              />
            )}
          </>
        )}
      </ScrollView>
    </Box>
  );
};

export default MarketList;
