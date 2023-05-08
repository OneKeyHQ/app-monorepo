import { useCallback, useContext, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  FlatList,
  Image,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import DAppIcon from '../../DAppIcon';
import { useDiscoverFavorites, useUserBrowserHistories } from '../../hooks';
import { DiscoverModalRoutes } from '../../type';
import { DiscoverContext } from '../context';

import type { MatchDAppItemType } from '../../Explorer/explorerUtils';
import type { SectionDataType } from '../../type';
import type { ListRenderItem } from 'react-native';

const ListHeaderItemsEmptyComponent = () => {
  const intl = useIntl();
  const { itemSource } = useContext(DiscoverContext);
  return (
    <Box px="4" w="full">
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

  if (favorites.length === 0) {
    return <ListHeaderItemsEmptyComponent />;
  }

  return (
    <FlatList
      horizontal
      data={favorites}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item, i) => `${item.id}${i}`}
    />
  );
};

const ListHeaderHistories = () => {
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const histories = useUserBrowserHistories();

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

  if (histories.length === 0) {
    return <ListHeaderItemsEmptyComponent />;
  }

  return (
    <FlatList
      horizontal
      data={histories}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => `${item.id}`}
      ListEmptyComponent={ListHeaderItemsEmptyComponent}
    />
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
  const dappItems = useAppSelector((s) => s.discover.home);
  const intl = useIntl();
  if (!dappItems) {
    return null;
  }
  return (
    <Box>
      {/* <DAppCategories /> */}
      <Box px="4">
        <Typography.Display2XLarge>
          {intl.formatMessage({ id: 'title__browser' })}
        </Typography.Display2XLarge>
      </Box>
      {platformEnv.isWeb ? null : <ListHeaderItems />}
    </Box>
  );
};

export const Beta = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    if (platformEnv.isNative) {
      navigation.setOptions({
        title: intl.formatMessage({
          id: 'title__explore',
        }),
      });
    }
  }, [navigation, intl]);

  const renderItem: ListRenderItem<SectionDataType> = useCallback(
    () => null,
    [],
  );

  return (
    <Box flex="1" bg="background-default">
      <FlatList
        contentContainerStyle={{
          paddingBottom: 12,
          paddingTop: 12,
        }}
        data={[]}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.title ?? ''}${index}`}
        ListHeaderComponent={ListHeaderComponent}
        showsVerticalScrollIndicator={false}
      />
    </Box>
  );
};
