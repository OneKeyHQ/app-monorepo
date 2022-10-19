import React, { FC, useCallback, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import {
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView as ScrollViewType,
} from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  IconButton,
  ScrollView,
} from '@onekeyhq/components/src';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';

import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import {
  MARKET_FAVORITES_CATEGORYID,
  MarketCategory,
} from '../../store/reducers/market';

import MarketCategoryToggles from './Components/MarketList/MarketCategoryToggles';
import { showMarketCellMoreMenu } from './Components/MarketList/MarketCellMoreMenu';
import MarketListHeader from './Components/MarketList/MarketListHeader';
import MarketRecomment from './Components/MarketList/MarketRecomment';
import MarketTokenCell from './Components/MarketList/MarketTokenCell';
import { ListHeadTags, MARKET_FAKE_SKELETON_LIST_ARRAY } from './config';
import {
  useMarketCategoryList,
  useMarketFavoriteCategoryTokenIds,
  useMarketFavoriteRecommentedList,
} from './hooks/useMarketCategory';
import { useMarketList } from './hooks/useMarketList';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const MarketList: FC = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const categorys: MarketCategory[] = useMarketCategoryList();
  const recommendedTokens = useMarketFavoriteRecommentedList();
  const favoriteTokens = useMarketFavoriteCategoryTokenIds();
  const { selectedCategory } = useMarketList();
  const listHeadTags = isVerticalLayout
    ? ListHeadTags.filter((t) => t.isVerticalLayout)
    : ListHeadTags;
  const navigation = useNavigation<NavigationProps>();
  const scrollRef = useRef<ScrollViewType>(null);
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
  const [goToTopBtnShow, setGoToTopBtnShow] = useState(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetHeight = e.nativeEvent.contentOffset.y;
    setGoToTopBtnShow((offsetHeight ?? 0) > 200);
  }, []);
  return (
    <Box flex={1}>
      <ScrollView
        ref={scrollRef}
        mt={4}
        p={isVerticalLayout ? 4 : 6}
        bg="background-default"
        onScroll={onScroll}
        contentContainerStyle={{
          paddingBottom: 24,
        }}
      >
        <MarketCategoryToggles categorys={categorys} />
        {selectedCategory &&
        selectedCategory.categoryId === MARKET_FAVORITES_CATEGORYID &&
        favoriteTokens.length === 0 &&
        recommendedTokens.length > 0 ? (
          <MarketRecomment tokens={recommendedTokens} />
        ) : (
          <FlatList
            data={
              !selectedCategory ||
              !selectedCategory.coingeckoIds ||
              selectedCategory.coingeckoIds.length === 0
                ? MARKET_FAKE_SKELETON_LIST_ARRAY
                : selectedCategory.coingeckoIds
            }
            renderItem={renderItem}
            ListHeaderComponent={() => (
              <MarketListHeader headTags={listHeadTags} />
            )}
            ItemSeparatorComponent={Divider}
          />
        )}
      </ScrollView>
      {goToTopBtnShow ? (
        <IconButton
          circle
          name="UploadSolid"
          position="absolute"
          size="base"
          type="basic"
          bottom="80px"
          right="20px"
          onPress={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTo({ y: 0, animated: true });
            }
          }}
        />
      ) : null}
    </Box>
  );
};

export default MarketList;
