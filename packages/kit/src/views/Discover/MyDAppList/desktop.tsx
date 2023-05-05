import type { FC } from 'react';
import { useCallback, useContext, useLayoutEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  FlatList,
  IconButton,
  Pressable,
  SegmentedControl,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';

import { useTranslation } from '../../../hooks';
import FavListMenu from '../../Overlay/Discover/FavListMenu';
import { Chains } from '../Chains';
import DAppIcon from '../DAppIcon';
import { useDiscoverFavorites, useUserBrowserHistories } from '../hooks';

import { MyDAppListContext } from './context';
import { getUrlHost } from './utils';

import type { MatchDAppItemType } from '../Explorer/explorerUtils';
import type { LayoutChangeEvent, ListRenderItem } from 'react-native';

const FavouritesListEmptyComponent = () => {
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
  isFav?: boolean;
};
const RenderItem: FC<RenderItemProps> = ({ item, cardWidth, isFav }) => {
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
    description = getUrlHost(url);
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
        <Box position="absolute" top="0" right="0">
          <FavListMenu item={item} isFav={isFav}>
            <IconButton type="plain" name="DotsHorizontalMini" />
          </FavListMenu>
        </Box>
        <Box>
          <Box flexDirection="row">
            <DAppIcon
              key={logoURL}
              size={48}
              url={logoURL}
              networkIds={networkIds}
            />
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
      </Pressable>
    </Box>
  );
};

const FavOrHisList = ({ isFav }: { isFav: boolean }) => {
  const favData = useDiscoverFavorites();
  const hisData = useUserBrowserHistories();

  const { screenWidth } = useUserDevice();
  const defaultBoxWidth = screenWidth > SCREEN_SIZE.LARGE ? 720 : screenWidth;
  const [boxWidth, setBoxWidth] = useState(defaultBoxWidth);
  const minWidth = 250;
  const numColumns = Math.floor(boxWidth / minWidth);
  const cardWidth = boxWidth / numColumns;

  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item }) => (
      <RenderItem cardWidth={cardWidth} item={item} isFav={isFav} />
    ),
    [cardWidth, isFav],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const { width } = e.nativeEvent.layout;
    if (width) {
      setBoxWidth(width);
    }
  }, []);

  return (
    <FlatList
      flex={1}
      onLayout={onLayout}
      contentContainerStyle={{ paddingTop: 32, paddingBottom: 32 }}
      // paddingLeft="24px"
      data={isFav ? favData : hisData}
      renderItem={renderItem}
      numColumns={numColumns}
      key={`key${numColumns}`}
      keyExtractor={(item) => `${numColumns}key${item.id}`}
      ListEmptyComponent={
        isFav ? FavouritesListEmptyComponent : HistoryListEmptyComponent
      }
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

  return (
    <Box w="full" h="full" mb="4" px="8">
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
      <FavOrHisList isFav={selectedIndex === 0} />
    </Box>
  );
};

export default Desktop;
