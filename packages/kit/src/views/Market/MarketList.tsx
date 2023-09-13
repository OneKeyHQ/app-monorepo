import type { FC } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import {
  Box,
  Divider,
  FlatList,
  IconButton,
  useUserDevice,
} from '@onekeyhq/components';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import { HomeRoutes } from '../../routes/routesEnum';
import { MARKET_FAVORITES_CATEGORYID } from '../../store/reducers/market';

import MarketCategoryToggles from './Components/MarketList/MarketCategoryToggles';
import { showMarketCellMoreMenu } from './Components/MarketList/MarketCellMoreMenu';
import MarketListHeader from './Components/MarketList/MarketListHeader';
import MarketRecomment from './Components/MarketList/MarketRecomment';
import MarketTokenCell from './Components/MarketList/MarketTokenCell';
import MarketTokenCellVertival from './Components/MarketList/MarketTokenCellVertival';
import {
  ListHeadTags,
  MARKET_FAKE_SKELETON_LIST_ARRAY,
  MARKET_LIST_COLUMN_SHOW_WIDTH_1,
  MARKET_LIST_COLUMN_SHOW_WIDTH_2,
  MARKET_LIST_COLUMN_SHOW_WIDTH_3,
} from './config';
import {
  useMarketCategoryList,
  useMarketFavoriteCategoryTokenIds,
  useMarketFavoriteRecommentedList,
  useSimplyMarketTabCategoryList,
} from './hooks/useMarketCategory';
import { useMarketWidthLayout } from './hooks/useMarketLayout';
import { useMarketList } from './hooks/useMarketList';

import type { HomeRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  FlatList as FlatListType,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const MarketList: FC = () => {
  const { screenWidth } = useUserDevice();
  const { marketFillWidth, isVerticalLayout } = useMarketWidthLayout();
  useMarketCategoryList();
  const categories = useSimplyMarketTabCategoryList();
  const recommendedTokens = useMarketFavoriteRecommentedList();
  const favoriteTokens = useMarketFavoriteCategoryTokenIds();
  const { selectedCategory, onRefreshingMarketList } = useMarketList();
  const listHeadTags = useMemo(() => {
    if (isVerticalLayout) {
      return ListHeadTags.filter((t) => t.showVerticalLayout);
    }
    if (marketFillWidth <= MARKET_LIST_COLUMN_SHOW_WIDTH_1) {
      return ListHeadTags.filter((t) => !t.hide824Width);
    }
    if (
      marketFillWidth > MARKET_LIST_COLUMN_SHOW_WIDTH_1 &&
      marketFillWidth <= MARKET_LIST_COLUMN_SHOW_WIDTH_2
    ) {
      return ListHeadTags.filter((t) => !t.hide924Width);
    }
    if (
      marketFillWidth > MARKET_LIST_COLUMN_SHOW_WIDTH_2 &&
      marketFillWidth < MARKET_LIST_COLUMN_SHOW_WIDTH_3
    ) {
      // 去掉缩略图
      return ListHeadTags.filter((t) => !t.hide1024Width);
    }
    return ListHeadTags;
  }, [isVerticalLayout, marketFillWidth]);
  const navigation = useNavigation<NavigationProps>();
  const scrollRef = useRef<FlatListType>(null);
  const renderItem: ListRenderItem<string> = useCallback(
    ({ item }) =>
      isVerticalLayout ? (
        <MarketTokenCellVertival
          marketTokenId={item}
          onPress={() => {
            // goto detail
            navigation.navigate(HomeRoutes.MarketDetail, {
              marketTokenId: item,
            });
          }}
          onLongPress={(marketTokenItem) => {
            showMarketCellMoreMenu(marketTokenItem, {
              header: `${marketTokenItem.symbol ?? marketTokenItem.name ?? ''}`,
            });
          }}
        />
      ) : (
        <MarketTokenCell
          marketTokenId={item}
          headTags={listHeadTags}
          onPress={() => {
            // goto detail
            navigation.navigate(HomeRoutes.MarketDetail, {
              marketTokenId: item,
            });
          }}
          onLongPress={(marketTokenItem) => {
            showMarketCellMoreMenu(marketTokenItem, {
              header: `${marketTokenItem.symbol ?? marketTokenItem.name ?? ''}`,
            });
          }}
        />
      ),
    [isVerticalLayout, listHeadTags, navigation],
  );
  const [goToTopBtnShow, setGoToTopBtnShow] = useState(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetHeight = e.nativeEvent.contentOffset.y;
    setGoToTopBtnShow((offsetHeight ?? 0) > 200);
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    onRefreshingMarketList().finally(() => {
      setRefreshing(false);
    });
  }, [onRefreshingMarketList]);
  const showRecomended = useMemo(
    () =>
      selectedCategory &&
      selectedCategory.categoryId === MARKET_FAVORITES_CATEGORYID &&
      !favoriteTokens.length &&
      recommendedTokens.length > 0,
    [favoriteTokens.length, recommendedTokens.length, selectedCategory],
  );

  const header = useMemo(
    () => (
      <Box pt={1} mt={-1} bgColor="background-default">
        {showRecomended ? (
          <MarketRecomment tokens={recommendedTokens} />
        ) : (
          <MarketListHeader headTags={listHeadTags} />
        )}
      </Box>
    ),
    [listHeadTags, recommendedTokens, showRecomended],
  );

  return (
    <>
      <Box
        flex={1}
        px={isVerticalLayout ? 2 : 3}
        style={{
          maxWidth: MAX_PAGE_CONTAINER_WIDTH,
          width: '100%',
          marginHorizontal: 'auto',
          alignSelf: 'center',
          paddingTop: isVerticalLayout ? 0 : 32,
        }}
      >
        <MarketCategoryToggles categories={categories} />
        <FlatList
          flex={1}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ref={scrollRef}
          bg="background-default"
          onScroll={onScroll}
          contentContainerStyle={{
            paddingBottom: 24,
          }}
          keyExtractor={(item, index) => `${item}-${index}`}
          stickyHeaderIndices={[0]}
          scrollEventThrottle={200}
          data={
            // eslint-disable-next-line no-nested-ternary
            showRecomended
              ? null
              : selectedCategory?.coingeckoIds?.length
              ? selectedCategory.coingeckoIds
              : MARKET_FAKE_SKELETON_LIST_ARRAY
          }
          renderItem={renderItem}
          ItemSeparatorComponent={!isVerticalLayout ? Divider : null}
          ListHeaderComponent={header}
        />
      </Box>
      {goToTopBtnShow && (
        <IconButton
          circle
          name="UploadMini"
          position="absolute"
          size="base"
          type="basic"
          bottom="80px"
          right={screenWidth > 1144 ? `${(screenWidth - 1144) / 2}px` : '20px'}
          onPress={() => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
        />
      )}
    </>
  );
};

export default memo(MarketList);
