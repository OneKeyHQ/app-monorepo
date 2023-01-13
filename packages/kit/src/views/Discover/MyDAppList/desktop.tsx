import type { FC } from 'react';
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Empty,
  FlatList,
  IconButton,
  Pressable,
  SegmentedControl,
  Typography,
} from '@onekeyhq/components';

import { useTranslation } from '../../../hooks';
import { showFavoriteMenu } from '../../Overlay/Discover/FavoriteMenu';
import { showHistoryMenu } from '../../Overlay/Discover/HistoryMenu';
import { Chains } from '../Chains';
import DAppIcon from '../DAppIcon';
import { useDiscoverFavorites, useUserBrowserHistories } from '../hooks';

import { MyDAppListContext } from './context';

import type { ShowMenuProps } from '../../Overlay/Discover/type';
import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { ListRenderItem } from 'react-native';

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

type RenderItemProps = {
  item: MatchDAppItemType;
  cardWidth: number;
  callback: ShowMenuProps;
};
const RenderItem: FC<RenderItemProps> = ({ item, cardWidth, callback }) => {
  const ref = useRef();
  const t = useTranslation();
  const { onItemSelect } = useContext(MyDAppListContext);

  const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
  const name = item.dapp?.name ?? item.webSite?.title ?? 'Unknown';
  const url = item.dapp?.url ?? item.webSite?.url;
  const networkIds = item.dapp?.networkIds;
  let description = 'Unknown';
  if (item.dapp) {
    description = t(item.dapp._subtitle) ?? item.dapp.subtitle;
  } else if (url) {
    description = new URL(url).host;
  }

  return (
    <Box
      width={cardWidth}
      maxWidth={cardWidth}
      minWidth={cardWidth}
      height={156}
      paddingX="2"
      justifyContent="center"
      alignItems="center"
    >
      <Pressable
        bgColor="surface-default"
        flexDirection="column"
        borderRadius="12"
        padding="4"
        width={cardWidth - 16}
        height={144}
        borderWidth={1}
        _hover={{ bgColor: 'surface-hovered' }}
        borderColor="border-subdued"
        position="relative"
        onPress={() => {
          onItemSelect?.(item);
        }}
      >
        <>
          <Box position="absolute" top="0" right={0} ref={ref} zIndex="1">
            <IconButton
              type="plain"
              name="DotsHorizontalMini"
              onPress={() => callback({ triggerEle: ref.current, dapp: item })}
            />
          </Box>
          <Box>
            <Box flexDirection="row">
              <DAppIcon size={48} url={logoURL} networkIds={networkIds} />
              <Box ml="3" flex="1">
                <Typography.Body2Strong flex={1} numberOfLines={1} mb="1">
                  {name}
                </Typography.Body2Strong>
                {networkIds ? <Chains networkIds={networkIds} /> : null}
              </Box>
            </Box>
            <Typography.Caption
              mt="3"
              numberOfLines={2}
              textAlign="left"
              color="text-subdued"
            >
              {description}
            </Typography.Caption>
          </Box>
        </>
      </Pressable>
    </Box>
  );
};

const Favorites = () => {
  const data = useDiscoverFavorites();
  const { width } = useWindowDimensions();
  const screenWidth = width - 64 - 224;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;

  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item }) => (
      <RenderItem
        cardWidth={cardWidth}
        item={item}
        callback={showFavoriteMenu}
      />
    ),
    [],
  );

  return (
    <FlatList
      contentContainerStyle={{ paddingTop: 32, paddingBottom: 32 }}
      // paddingLeft="24px"
      data={data}
      renderItem={renderItem}
      numColumns={numColumns}
      key={`key${numColumns}`}
      keyExtractor={(item) => `${numColumns}key${item.id}`}
      ListEmptyComponent={FavoratesListEmptyComponent}
    />
  );
};

const History = () => {
  const { width } = useWindowDimensions();
  const data = useUserBrowserHistories();
  const screenWidth = width - 64 - 224;

  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;

  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item }) => (
      <RenderItem
        cardWidth={cardWidth}
        item={item}
        callback={showHistoryMenu}
      />
    ),
    [cardWidth],
  );

  return (
    <FlatList
      contentContainerStyle={{ paddingTop: 32, paddingBottom: 32 }}
      // paddingLeft="24px"
      data={data}
      renderItem={renderItem}
      numColumns={numColumns}
      key={`key${numColumns}`}
      keyExtractor={(item) => `${numColumns}key${item.id}`}
      ListEmptyComponent={HistoryListEmptyComponent}
    />
  );
};

const Desktop = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { defaultIndex } = useContext(MyDAppListContext);
  const [selectedIndex, setSelectedIndex] = useState<number>(defaultIndex ?? 0);
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const favorates = useMemo(() => <Favorites />, []);
  const history = useMemo(() => <History />, []);
  return (
    <Box width="full" height="full" mb="4" px="8">
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box flexDirection="row" alignItems="center" py="5">
          <IconButton onPress={onBack} type="plain" name="ArrowLeftOutline" />
          <Typography.DisplayLarge px="4">
            {intl.formatMessage({ id: 'title__my_dapps' })}
          </Typography.DisplayLarge>
        </Box>
        <Box width="56">
          <SegmentedControl
            values={[
              intl.formatMessage({ id: 'title__favorites' }),
              intl.formatMessage({ id: 'transaction__history' }),
            ]}
            selectedIndex={selectedIndex}
            onChange={setSelectedIndex}
          />
        </Box>
      </Box>
      <Box flex="1">{selectedIndex === 0 ? favorates : history}</Box>
    </Box>
  );
};

export default Desktop;
