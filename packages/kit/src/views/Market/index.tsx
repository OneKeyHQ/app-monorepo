import React, { useCallback, useEffect, useMemo } from 'react';

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

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import {
  MARKET_FAVORITES_CATEGORYID,
  MarketCategory,
} from '../../store/reducers/market';

import MarketCategoryToggles from './Components/MarketList/MarketCategoryToggles';
import MarketListHeader from './Components/MarketList/MarketListHeader';
import MarketRecomment from './Components/MarketList/MarketRecomment';
import MarketTokenCell from './Components/MarketList/MarketTokenCell';
import { MarketHeader, MarketHeaderNative } from './Components/MarketTopHeader';
import { ListHeadTags } from './config';
import {
  useMarketCategoryList,
  useMarketFavoriteCategoryTokenIds,
  useMarketFavoriteRecommentedList,
} from './hooks/useMarketCategory';
import { useMarketList } from './hooks/useMarketList';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const Market = () => {
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
      />
    ),
    [listHeadTags, navigation],
  );

  return (
    <Box flex="1">
      {isVerticalLayout ? (
        <MarketHeaderNative />
      ) : (
        <>
          <MarketHeader
            onChange={(keyword) => {
              console.log('keyword--', keyword);
            }}
            keyword=""
          />
        </>
      )}

      <ScrollView mt={6} p={4} bg="background-default">
        {!selectedCategory ? (
          <Center flex={1}>
            <Spinner size="lg" />
          </Center>
        ) : (
          <>
            <MarketCategoryToggles categorys={categorys} />
            {selectedCategory.categoryId === MARKET_FAVORITES_CATEGORYID &&
            favoriteTokens?.length === 0 &&
            recommendedTokens &&
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
                  <Empty
                    emoji="⭐️"
                    title="No Favorite Token"
                    subTitle="Your Favorite tokens will show here."
                  />
                }
              />
            )}
          </>
        )}
      </ScrollView>
    </Box>
  );
};

export default Market;
