import { FC, useCallback, useContext, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Button,
  FlatList,
  Image,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import ScrollableButtonGroup from '@onekeyhq/components/src/ScrollableButtonGroup/ScrollableButtonGroup';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../../routes/types';
import DAppIcon from '../../DAppIcon';
import { useDiscoverFavorites, useDiscoverHistory } from '../../hooks';
import { DiscoverModalRoutes } from '../../type';
import CardView from '../CardView';
import { DiscoverContext } from '../context';

import type { SectionDataType } from '../../type';

const ListHeaderItemsEmptyComponent = () => {
  const intl = useIntl();
  const { itemSource } = useContext(DiscoverContext);
  return (
    <Box>
      <Box
        width="full"
        h="20"
        borderRadius={12}
        bg="surface-subdued"
        justifyContent="center"
        alignItems="center"
      >
        <Typography.Body1 textAlign="center" color="text-subdued">
          {itemSource === 'Favorites'
            ? intl.formatMessage({ id: 'message__discover_favorite_is_empty' })
            : intl.formatMessage({ id: 'message__discover_history_is_empty' })}
        </Typography.Body1>
      </Box>
    </Box>
  );
};

const ListHeaderFavorites = () => {
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const favorites = useDiscoverFavorites();

  const children = useMemo(
    () =>
      favorites.slice(0, 20).map((item) => {
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
      }),
    [favorites, onItemSelectHistory],
  );

  return favorites.length ? (
    <ScrollableButtonGroup justifyContent="center" bg="transparent">
      {children}
    </ScrollableButtonGroup>
  ) : (
    <ListHeaderItemsEmptyComponent />
  );
};

const ListHeaderHistories = () => {
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const histories = useDiscoverHistory();

  const children = useMemo(
    () =>
      histories.slice(0, 20).map((item) => {
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
            <Image w="10" h="10" src={logoURL} borderRadius={12} mb="1.5" />
            <Typography.Caption w="12" numberOfLines={1} textAlign="center">
              {name ?? 'Unknown'}
            </Typography.Caption>
          </Pressable>
        );
      }),
    [histories, onItemSelectHistory],
  );

  return histories.length ? (
    <ScrollableButtonGroup justifyContent="center" bg="transparent">
      {children}
    </ScrollableButtonGroup>
  ) : (
    <ListHeaderItemsEmptyComponent />
  );
};

const ListHeaderItems = () => {
  const intl = useIntl();
  const { itemSource, setItemSource, onItemSelectHistory } =
    useContext(DiscoverContext);

  return (
    <Box px="8" pt="8">
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" mb="3">
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
    <Box>
      {/* <DAppCategories /> */}
      {platformEnv.isWeb ? null : <ListHeaderItems />}
    </Box>
  );
};

export const Beta: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const { onItemSelect } = useContext(DiscoverContext);

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
    ({ item }) => <CardView {...item} onItemSelect={onItemSelect} />,
    [onItemSelect],
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
      />
    </Box>
  );
};
