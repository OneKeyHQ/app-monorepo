import {
  FC,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Button,
  CustomSkeleton,
  FlatList,
  Image,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import DAppIcon from '../DAppIcon';
import { useDiscoverFavorites, useDiscoverHistory } from '../hooks';

import CardView from './CardView';
import { DiscoverContext, ItemSource } from './context';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { DAppItemType, SectionDataType } from '../type';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.DAppListScreen
>;

interface DiscoverProps {
  onItemSelect: (item: DAppItemType) => void;
  onItemSelectHistory: (item: MatchDAppItemType) => void;
}

const ListEmptyComponent = () => (
  <FlatList
    contentContainerStyle={{
      paddingBottom: 24,
      paddingTop: 24,
    }}
    data={[1, 2, 3, 4, 5, 6, 7, 8]}
    renderItem={() => (
      <Box px="4" w="full">
        <Box h="4" borderRadius={8} mb="3" overflow="hidden">
          <CustomSkeleton />
        </Box>
        <Box h="3" borderRadius={6} overflow="hidden" width="70%">
          <CustomSkeleton />
        </Box>
      </Box>
    )}
    keyExtractor={(item) => String(item)}
    ItemSeparatorComponent={() => <Box h="8" />}
  />
);

const ListHeaderLabels = () => {
  const { categoryId, setCategoryId } = useContext(DiscoverContext);
  const isSmall = useIsVerticalLayout();
  const categories = useAppSelector((s) => s.discover.categories);

  const data = useMemo(() => {
    if (!categories) {
      return [];
    }
    return [{ name: 'Mine', _id: '' }].concat(categories);
  }, [categories]);

  const renderItem: ListRenderItem<{ name: string; _id: string }> = ({
    item,
  }) => (
    <Pressable
      py="2"
      px="3"
      bg={categoryId === item._id ? 'surface-selected' : undefined}
      onPress={() => setCategoryId(item._id)}
      borderRadius={12}
    >
      <Typography.Body2
        color={categoryId === item._id ? 'text-default' : 'text-subdued'}
      >
        {item.name}
      </Typography.Body2>
    </Pressable>
  );
  if (!data.length) {
    return null;
  }
  return (
    <FlatList
      horizontal
      data={data}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={platformEnv.isDesktop}
      keyExtractor={(item) => item._id}
      contentContainerStyle={
        isSmall
          ? {
              paddingHorizontal: 16,
            }
          : {
              paddingHorizontal: 32,
            }
      }
    />
  );
};

const ListHeaderItemsEmptyComponent = () => {
  const intl = useIntl();
  const isSmall = useIsVerticalLayout();
  const { itemSource } = useContext(DiscoverContext);
  return (
    <Box px={isSmall ? '4' : undefined}>
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
      data={histories}
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
  const isSmall = useIsVerticalLayout();
  const { itemSource, setItemSource, onItemSelectHistory } =
    useContext(DiscoverContext);

  return (
    <Box px={isSmall ? undefined : '8'} pt={isSmall ? '6' : '8'}>
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" mb="3" px={isSmall ? '4' : undefined}>
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

const ListHeaderComponent = () => (
  <Box>
    <ListHeaderLabels />
    {platformEnv.isWeb ? null : <ListHeaderItems />}
  </Box>
);

const DiscoverHome: FC<DiscoverProps> = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const dapps = useAppSelector((s) => s.discover.dapps);
  const { categoryId, onItemSelect } = useContext(DiscoverContext);

  const data = useMemo(() => {
    if (!dapps) return [];
    if (!categoryId) {
      return dapps.map((item) => ({ title: item.label, data: item.items }));
    }

    const items = dapps.map((item) => {
      const result = item.items.filter((o) => {
        const ids = o.categories.map((e) => e._id);
        return ids.includes(categoryId);
      });
      return { title: item.label, data: result };
    });

    return items.filter((item) => item.data.length !== 0);
  }, [dapps, categoryId]);

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

  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceDiscover.getDapps();
    }, []),
  );

  if (data.length === 0) {
    return <ListEmptyComponent />;
  }

  return (
    <Box flex="1" bg="background-default">
      <FlatList
        contentContainerStyle={{
          paddingBottom: 24,
          paddingTop: 24,
        }}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.title ?? ''}${index}`}
        ListHeaderComponent={ListHeaderComponent}
      />
    </Box>
  );
};

const DiscoverPage: FC<DiscoverProps> = ({ ...props }) => {
  const [categoryId, setCategoryId] = useState('');
  const [itemSource, setItemSource] = useState<ItemSource>('Favorites');
  return (
    <DiscoverContext.Provider
      value={{
        categoryId,
        setCategoryId,
        itemSource,
        setItemSource,
        onItemSelect: props.onItemSelect,
        onItemSelectHistory: props.onItemSelectHistory,
      }}
    >
      <DiscoverHome {...props} />
    </DiscoverContext.Provider>
  );
};

export default DiscoverPage;
