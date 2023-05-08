import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Empty,
  FlatList,
  Pressable,
  ScrollView,
  Typography,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import DAppIcon from '../../DAppIcon';
import {
  useDiscoverFavorites,
  useTaggedDapps,
  useUserBrowserHistories,
} from '../../hooks';
import { DiscoverModalRoutes } from '../../type';
import CardView from '../CardView';
import { DiscoverContext } from '../context';

import { DAppCategories } from './DAppCategories';
import { EmptySkeleton } from './EmptySkeleton';

import type { MatchDAppItemType } from '../../Explorer/explorerUtils';
import type { SectionDataType, TagDappsType } from '../../type';
import type { ListRenderItem } from 'react-native';

const styles = StyleSheet.create({
  listContentContainer: {
    paddingBottom: 62,
    paddingTop: 12,
  },
});

const ListHeaderItemsEmptyComponent = () => {
  const intl = useIntl();
  const { itemSource } = useContext(DiscoverContext);
  return (
    <Box px="4">
      <Box
        w="full"
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
  const histories = useUserBrowserHistories();
  const items = useMemo(() => histories.slice(0, 8), [histories]);

  const renderItem = (item: MatchDAppItemType) => {
    const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
    const name = item.dapp?.name ?? item.webSite?.title;
    return (
      <Pressable
        key={item.id}
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
  return items.length > 0 ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {items.map(renderItem)}
    </ScrollView>
  ) : (
    <ListHeaderItemsEmptyComponent />
  );
};

const ListHeaderItems = () => {
  const intl = useIntl();
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
            getAppNavigation().navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Discover,
              params: {
                screen: DiscoverModalRoutes.MyDAppListModal,
                params: {
                  onItemSelect: onItemSelectHistory,
                  defaultIndex: itemSource === 'Favorites' ? 0 : 1,
                },
              },
            });
          }}
          height="32px"
          type="plain"
          size="sm"
          rightIconName="ChevronRightMini"
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
  const home = useAppSelector((s) => s.discover.home);
  if (!home) {
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
  const home = useAppSelector((s) => s.discover.home);
  return home ? <Empty title="" /> : <EmptySkeleton />;
};

export const Mine = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const fullDapps = useTaggedDapps();
  const [dapps, setDapps] = useState<TagDappsType[]>([]);
  const [total, setTotal] = useState<number>(10);
  const { onItemSelect } = useContext(DiscoverContext);

  const data = useMemo(() => {
    const items = dapps.map((item) => ({
      title: item.label,
      data: item.items,
      tagId: item.id,
      _title: item._label,
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
        windowSize={10}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.title ?? ''}${index}`}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
      />
    </Box>
  );
};
