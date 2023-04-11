import type { FC } from 'react';
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Empty,
  FlatList,
  IconButton,
  Pressable,
  SegmentedControl,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation, useTranslation } from '../../../hooks';
import FavListMenu from '../../Overlay/Discover/FavListMenu';
import DAppIcon from '../DAppIcon';
import { useDiscoverFavorites, useUserBrowserHistories } from '../hooks';

import { MyDAppListContext } from './context';
import { getUrlHost } from './utils';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { ListRenderItem } from 'react-native';

type RenderItemProps = { item: MatchDAppItemType; isFav?: boolean };

const RenderItem: FC<RenderItemProps> = ({ item, isFav }) => {
  const { onItemSelect } = useContext(MyDAppListContext);
  const t = useTranslation();
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
      mb="5"
      onPress={() => {
        onItemSelect?.(item);
      }}
      flexDirection="row"
      flex={1}
      alignItems="center"
      justifyContent="space-between"
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
      <FavListMenu item={item} isFav={isFav}>
        <IconButton type="plain" name="DotsHorizontalMini" />
      </FavListMenu>
    </Pressable>
  );
};

const FavoratesListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      emoji="⭐️"
      title={intl.formatMessage({ id: 'title__no_favorite_dapp' })}
      subTitle={intl.formatMessage({ id: 'title__no_favorite_dapp_desc' })}
    />
  );
};

const HistoryListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      emoji="🕘"
      title={intl.formatMessage({ id: 'title__no_history' })}
      subTitle={intl.formatMessage({ id: 'title__no_history_desc' })}
    />
  );
};

const Favorites = () => {
  const data = useDiscoverFavorites();
  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item }) => <RenderItem item={item} isFav />,
    [],
  );
  return (
    <FlatList
      contentContainerStyle={{ paddingVertical: 24 }}
      data={data}
      px="4"
      renderItem={renderItem}
      keyExtractor={(item) => `${item.id}`}
      ListEmptyComponent={FavoratesListEmptyComponent}
    />
  );
};

const History = () => {
  const data = useUserBrowserHistories();
  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item }) => <RenderItem item={item} />,
    [],
  );
  return (
    <FlatList
      contentContainerStyle={{ paddingVertical: 24 }}
      data={data}
      px="4"
      renderItem={renderItem}
      keyExtractor={(item) => `${item.id}`}
      ListEmptyComponent={HistoryListEmptyComponent}
    />
  );
};

const TrashButton = () => {
  const intl = useIntl();
  const [visible, setVisible] = useState(false);
  const onPress = useCallback(() => {
    setVisible(true);
  }, []);
  const onClear = useCallback(() => {
    backgroundApiProxy.serviceDiscover.clearHistory();
    setVisible(false);
  }, []);
  return (
    <Box px="4">
      <IconButton type="plain" name="TrashOutline" onPress={onPress} />
      <Dialog
        visible={visible}
        contentProps={{
          iconName: 'TrashMini',
          iconType: 'danger',
          title: intl.formatMessage({ id: 'modal__clear_history' }),
          content: intl.formatMessage({
            id: 'modal__clear_history_desc',
          }),
        }}
        footerButtonProps={{
          primaryActionTranslationId: 'action__clear',
          primaryActionProps: { type: 'destructive' },
          onPrimaryActionPress: onClear,
          onSecondaryActionPress() {
            setVisible(false);
          },
        }}
      />
    </Box>
  );
};

const Mobile = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { defaultIndex } = useContext(MyDAppListContext);
  const [selectedIndex, setSelectedIndex] = useState<number>(defaultIndex ?? 0);

  const favorites = useMemo(() => <Favorites />, []);
  const history = useMemo(() => <History />, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      // eslint-disable-next-line
      headerRight: () => (selectedIndex === 0 ? null : <TrashButton />),
    });
  }, [navigation, selectedIndex]);

  return (
    <Box flex="1" bg="background-default">
      <Box px={{ base: 4, md: 6 }} mt={4}>
        <SegmentedControl
          values={[
            intl.formatMessage({ id: 'title__favorites' }),
            intl.formatMessage({ id: 'transaction__history' }),
          ]}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </Box>
      <Box flex="1">{selectedIndex === 0 ? favorites : history}</Box>
    </Box>
  );
};

export default Mobile;
