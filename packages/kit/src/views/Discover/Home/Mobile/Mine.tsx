import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem, StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Empty,
  FlatList,
  Image,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { HomeRoutes, HomeRoutesParams } from '../../../../routes/types';
import DAppIcon from '../../DAppIcon';
import {
  useDiscoverFavorites,
  useDiscoverHistory,
  useTaggedDapps,
} from '../../hooks';
import CardView from '../CardView';
import { DiscoverContext } from '../context';

import { DAppCategories } from './DAppCategories';
import { EmptySkeleton } from './EmptySkeleton';

import type { MatchDAppItemType } from '../../Explorer/explorerUtils';
import type { DAppItemType, SectionDataType } from '../../type';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

const styles = StyleSheet.create({
  listContentContainer: {
    paddingBottom: 12,
    paddingTop: 12,
  },
});

const ListHeaderItemsEmptyComponent = () => {
  const intl = useIntl();
  const { itemSource } = useContext(DiscoverContext);
  return (
    <Box px="4">
      <Box
        width="full"
        h="20"
        borderRadius={12}
        bg="surface-subdued"
        justifyContent="center"
        alignItems="center"
      >
        <Typography.Body2 textAlign="center" color="text-subdued">
          {itemSource === 'Favorites'
            ? intl.formatMessage({ id: 'message__discover_favorite_is_empty' })
            : intl.formatMessage({ id: 'message__discover_history_is_empty' })}
        </Typography.Body2>
      </Box>
    </Box>
  );
};

const ListHeaderFavorites = () => {
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const favorites = useDiscoverFavorites();

  const renderItem: ListRenderItem<MatchDAppItemType> = ({ item }) => {
    const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
    const name = item.dapp?.name ?? item.webSite?.title;
    return (
      <Pressable
        py="2"
        px="3"
        borderRadius={12}
        justifyContent="center"
        alignItems="center"
        onPress={() => onItemSelectHistory(item)}
      >
        <DAppIcon size={48} url={logoURL} borderRadius={12} mb="1.5" />
        <Typography.Caption w="12" numberOfLines={1} textAlign="center">
          {name ?? 'Unknown'}
        </Typography.Caption>
      </Pressable>
    );
  };
  return favorites.length ? (
    <FlatList
      horizontal
      data={favorites}
      renderItem={renderItem}
      removeClippedSubviews
      windowSize={5}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item, i) => `${item.id}${i}`}
      ListEmptyComponent={ListHeaderItemsEmptyComponent}
    />
  ) : (
    <ListHeaderItemsEmptyComponent />
  );
};

const ListHeaderHistories = () => {
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const histories = useDiscoverHistory();

  const renderItem: ListRenderItem<MatchDAppItemType> = ({ item }) => {
    const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
    const name = item.dapp?.name ?? item.webSite?.title;
    return (
      <Pressable
        py="2"
        px="3"
        borderRadius={12}
        justifyContent="center"
        alignItems="center"
        onPress={() => onItemSelectHistory(item)}
      >
        <Image w="10" h="10" src={logoURL} borderRadius={12} mb="1.5" />
        <Typography.Caption w="12" numberOfLines={1} textAlign="center">
          {name ?? 'Unknown'}
        </Typography.Caption>
      </Pressable>
    );
  };
  return histories.length ? (
    <FlatList
      horizontal
      data={histories.slice(0, 8)}
      removeClippedSubviews
      windowSize={5}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => `${item.id}`}
      ListEmptyComponent={ListHeaderItemsEmptyComponent}
    />
  ) : (
    <ListHeaderItemsEmptyComponent />
  );
};

const ListHeaderItems = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { itemSource, setItemSource, onItemSelectHistory } =
    useContext(DiscoverContext);

  return (
    <Box pt="6">
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" mb="3" px="4">
          <Pressable onPress={() => setItemSource('Favorites')}>
            <Typography.Heading
              color={
                itemSource === 'Favorites' ? 'text-default' : 'text-subdued'
              }
            >
              {intl.formatMessage({ id: 'title__favorites' })}
            </Typography.Heading>
          </Pressable>
          <Box w="4" />
          <Pressable onPress={() => setItemSource('History')}>
            <Typography.Heading
              color={itemSource === 'History' ? 'text-default' : 'text-subdued'}
            >
              {intl.formatMessage({ id: 'transaction__history' })}
            </Typography.Heading>
          </Pressable>
        </Box>
        <Button
          onPress={() => {
            navigation.navigate(HomeRoutes.MyDAppListScreen, {
              onItemSelect: onItemSelectHistory,
              defaultIndex: itemSource === 'Favorites' ? 0 : 1,
            });
          }}
          height="32px"
          type="plain"
          size="sm"
          rightIconName="ChevronRightSolid"
          textProps={{ color: 'text-subdued' }}
        >
          {intl.formatMessage({ id: 'action__see_all' })}
        </Button>
      </Box>
      {itemSource === 'Favorites' ? (
        <ListHeaderFavorites />
      ) : (
        <ListHeaderHistories />
      )}
    </Box>
  );
};

const ListHeaderComponent = () => {
  const dappItems = useAppSelector((s) => s.discover.dappItems);
  if (!dappItems) {
    return null;
  }
  return (
    <>
      <DAppCategories />
      {platformEnv.isWeb ? null : <ListHeaderItems />}
    </>
  );
};

const ListEmptyComponent = () => {
  const dappItems = useAppSelector((s) => s.discover.dappItems);
  const listedCategories = useAppSelector((s) => s.discover.listedCategories);
  return dappItems && listedCategories ? <Empty title="" /> : <EmptySkeleton />;
};

export const Mine = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const fullDapps = useTaggedDapps();
  const [dapps, setDapps] = useState<
    { label: string; id: string; items: DAppItemType[] }[]
  >([]);
  const [total, setTotal] = useState<number>(5);
  const { onItemSelect } = useContext(DiscoverContext);

  const data = useMemo(() => {
    const items = dapps.map((item) => ({
      title: item.label,
      data: item.items,
    }));
    return total < items.length ? items.slice(0, total) : items;
  }, [dapps, total]);

  useEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
    setTimeout(() => {
      setDapps(fullDapps);
    });
  }, [navigation, intl, fullDapps]);

  const renderItem: ListRenderItem<SectionDataType> = useCallback(
    ({ item }) => <CardView {...item} onItemSelect={onItemSelect} />,
    [onItemSelect],
  );

  const onEndReached = useCallback(() => {
    if (dapps.length >= total) {
      setTotal(total * 2);
    }
  }, [dapps.length, total]);

  return (
    <Box flex="1" bg="background-default">
      <FlatList
        contentContainerStyle={styles.listContentContainer}
        data={data}
        removeClippedSubviews
        windowSize={5}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.title ?? ''}${index}`}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.2}
      />
    </Box>
  );
};
