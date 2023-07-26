import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  IconButton,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import { useNavigation, useTranslation } from '../../../hooks';
import FavListMenu from '../../Overlay/Discover/FavListMenu';
import DAppIcon from '../components/DAppIcon';
import { openMatchDApp } from '../Explorer/Controller/gotoSite';
import { useDiscoverFavorites } from '../hooks';
import { getUrlHost } from '../utils';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { FlatListProps } from 'react-native';

type FavoriteItemBoxProps = { item: MatchDAppItemType };

const FavoriteItemBox: FC<FavoriteItemBoxProps> = ({ item }) => {
  const navigation = useNavigation();
  const t = useTranslation();
  const onPress = useCallback(() => {
    openMatchDApp(item);
    navigation.goBack();
  }, [navigation, item]);
  const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
  const name = item.dapp?.name ?? item.webSite?.title ?? 'Unknown';
  const url = item.dapp?.url ?? item.webSite?.url;
  const networkIds = item.dapp?.networkIds;
  let description = 'Unknown';
  if (item.dapp) {
    description = t(item.dapp._subtitle) ?? item.dapp.subtitle;
  } else if (url) {
    description = getUrlHost(url);
  }

  return (
    <Pressable
      flexDirection="row"
      flex={1}
      alignItems="center"
      justifyContent="space-between"
      onPress={onPress}
    >
      <Box flexDirection="row" flex={1} alignItems="center">
        <DAppIcon
          key={logoURL}
          size={48}
          url={logoURL}
          networkIds={networkIds}
        />
        <Box flexDirection="column" ml="12px" flex={1}>
          <Typography.Body2Strong>{name}</Typography.Body2Strong>
          <Typography.Caption color="text-subdued" mt="4px" numberOfLines={1}>
            {description}
          </Typography.Caption>
        </Box>
      </Box>
      <FavListMenu item={item} isFav>
        <IconButton type="plain" name="DotsHorizontalMini" />
      </FavListMenu>
    </Pressable>
  );
};

const ItemSeparatorComponent = () => <Box h="4" />;

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      emoji="⭐️"
      title={intl.formatMessage({ id: 'title__no_favorite_dapp' })}
      subTitle={intl.formatMessage({ id: 'title__no_favorite_dapp_desc' })}
    />
  );
};

export const Favorites = () => {
  const intl = useIntl();
  const data = useDiscoverFavorites();
  const renderItem: FlatListProps<MatchDAppItemType>['renderItem'] =
    useCallback(({ item }) => <FavoriteItemBox item={item} />, []);
  const keyExtractor: FlatListProps<MatchDAppItemType>['keyExtractor'] = (
    item,
  ) => `${item.id}`;
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__favorites' })}
      footer={null}
      flatListProps={{
        // contentContainerStyle: { paddingVertical: 24 },
        data,
        px: '4',
        // @ts-ignore
        renderItem,
        // @ts-ignore
        keyExtractor,
        ListEmptyComponent,
        ItemSeparatorComponent,
      }}
    />
  );
};
