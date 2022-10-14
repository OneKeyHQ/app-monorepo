import React, { FC, useCallback, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import {
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView as ScrollViewType,
} from 'react-native';

import {
  Box,
  Center,
  Divider,
  Empty,
  FlatList,
  IconButton,
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
    const offsetHeight = platformEnv.isNativeIOS
      ? e.nativeEvent.targetContentOffset?.y
      : e.nativeEvent.contentOffset.y;
    setGoToTopBtnShow((offsetHeight ?? 0) > 200);
  }, []);
  return (
    <Box flex={1}>
      {!selectedCategory ? (
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <ScrollView
          ref={scrollRef}
          mt={6}
          p={4}
          bg="background-default"
          onScroll={onScroll}
        >
          <MarketCategoryToggles categorys={categorys} />
          {selectedCategory.categoryId === MARKET_FAVORITES_CATEGORYID &&
          favoriteTokens.length === 0 &&
          recommendedTokens.length > 0 ? (
            <MarketRecomment tokens={recommendedTokens} />
          ) : (
            <>
              {selectedCategory.coingeckoIds &&
              selectedCategory.coingeckoIds.length > 0 ? (
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
              ) : (
                <Center h="200px">
                  <Spinner size="lg" />
                </Center>
              )}
            </>
          )}
        </ScrollView>
      )}
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
