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

import { HomeRoutes } from '../../routes/routesEnum';
import { MARKET_FAVORITES_CATEGORYID } from '../../store/reducers/market';

import MarketCategoryToggles from './Components/MarketList/MarketCategoryToggles';
import { showMarketCellMoreMenu } from './Components/MarketList/MarketCellMoreMenu';
import MarketListHeader from './Components/MarketList/MarketListHeader';
import MarketRecomment from './Components/MarketList/MarketRecomment';
import MarketTokenCell from './Components/MarketList/MarketTokenCell';
import MarketTokenCellVertival from './Components/MarketList/MarketTokenCellVertival';
import { ListHeadTags, MARKET_FAKE_SKELETON_LIST_ARRAY } from './config';
import {
  useMarketCategoryList,
  useMarketFavoriteCategoryTokenIds,
  useMarketFavoriteRecommentedList,
} from './hooks/useMarketCategory';
import { useMarketList } from './hooks/useMarketList';

import type { HomeRoutesParams } from '../../routes/types';
import type { MarketCategory } from '../../store/reducers/market';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  FlatList as FlatListType,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const MarketList: FC = () => {
  const { size } = useUserDevice();
  const isVerticalLayout = size === 'SMALL';
  const categorys: MarketCategory[] = useMarketCategoryList();
  const recommendedTokens = useMarketFavoriteRecommentedList();
  const favoriteTokens = useMarketFavoriteCategoryTokenIds();
  const { selectedCategory, onRefreshingMarketList } = useMarketList();
  const listHeadTags = useMemo(() => {
    const isMidLayout = size === 'NORMAL';
    if (isMidLayout) {
      return ListHeadTags.filter((t) => t.showNorMalDevice);
    }
    if (isVerticalLayout) {
      return ListHeadTags.filter((t) => t.showVerticalLayout);
    }
    return ListHeadTags;
  }, [isVerticalLayout, size]);
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

  return (
    <>
      <FlatList
        flex={1}
        mt={3}
        px={isVerticalLayout ? 2 : 3}
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
        ListHeaderComponent={
          <Box pt={1} mt={-1} bgColor="background-default">
            <MarketCategoryToggles categorys={categorys} />
            {showRecomended ? (
              <MarketRecomment tokens={recommendedTokens} />
            ) : (
              <MarketListHeader headTags={listHeadTags} />
            )}
          </Box>
        }
      />
      {goToTopBtnShow && (
        <IconButton
          circle
          name="UploadMini"
          position="absolute"
          size="base"
          type="basic"
          bottom="80px"
          right="20px"
          onPress={() => {
            scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
          }}
        />
      )}
    </>
  );
};

export default memo(MarketList);
