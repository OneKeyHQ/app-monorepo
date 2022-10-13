import React, {
  FC,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Empty,
  FlatList,
  IconButton,
  Pressable,
  SegmentedControl,
  Typography,
} from '@onekeyhq/components';

import { showFavoriteMenu } from '../../Overlay/Discover/FavoriteMenu';
import { showHistoryMenu } from '../../Overlay/Discover/HistoryMenu';
import DAppIcon from '../DAppIcon';
import { MatchDAppItemType } from '../Explorer/explorerUtils';
import { useDiscoverFavorites, useDiscoverHistory } from '../hooks';

import { MyDAppListContext } from './context';

import type { ShowMenuProps } from '../../Overlay/Discover/type';

type RenderItemProps = { item: MatchDAppItemType; callback: ShowMenuProps };

const RenderItem: FC<RenderItemProps> = ({ item, callback }) => {
  const ref = useRef();
  const { onItemSelect } = useContext(MyDAppListContext);

  const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
  const name = item.dapp?.name ?? item.webSite?.title ?? 'Unknown';
  const url = item.dapp?.url ?? item.webSite?.url;
  const networkIds = item.dapp?.networkIds;
  let description = 'Unknown';
  if (item.dapp) {
    description = item.dapp.subtitle;
  } else if (url) {
    description = new URL(url).host;
  }

  return (
    <Pressable
      onPress={() => {
        onItemSelect?.(item);
      }}
    >
      <Box width="full" mb="5">
        <Box
          flexDirection="row"
          flex={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Box flexDirection="row" flex={1} alignItems="center">
            <DAppIcon size={48} url={logoURL} networkIds={networkIds} />
            <Box flexDirection="column" ml="12px" flex={1}>
              <Typography.Body2Strong>{name}</Typography.Body2Strong>
              <Typography.Caption
                color="text-subdued"
                mt="4px"
                numberOfLines={1}
              >
                {description}
              </Typography.Caption>
            </Box>
          </Box>
          <Box ref={ref}>
            <IconButton
              type="plain"
              name="DotsHorizontalSolid"
              onPress={() => callback({ triggerEle: ref.current, dapp: item })}
            />
          </Box>
        </Box>
      </Box>
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

const Favorates = () => {
  const data = useDiscoverFavorites();
  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item }) => <RenderItem item={item} callback={showFavoriteMenu} />,
    [],
  );
  return (
    <FlatList
      contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}
      data={data}
      px="4"
      renderItem={renderItem}
      keyExtractor={(item) => `${item.id}`}
      ListEmptyComponent={FavoratesListEmptyComponent}
    />
  );
};

const History = () => {
  const data = useDiscoverHistory();
  const renderItem: ListRenderItem<MatchDAppItemType> = useCallback(
    ({ item }) => <RenderItem item={item} callback={showHistoryMenu} />,
    [],
  );
  return (
    <FlatList
      contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}
      data={data}
      px="4"
      renderItem={renderItem}
      keyExtractor={(item) => `${item.id}`}
      ListEmptyComponent={HistoryListEmptyComponent}
    />
  );
};

const Mobile = () => {
  const intl = useIntl();
  const { defaultIndex } = useContext(MyDAppListContext);
  const [selectedIndex, setSelectedIndex] = useState<number>(defaultIndex ?? 0);

  const favorates = useMemo(() => <Favorates />, []);
  const history = useMemo(() => <History />, []);

  return (
    <Box flex="1" bg="background-default">
      <Box px={{ base: 4, md: 6 }}>
        <SegmentedControl
          values={[
            intl.formatMessage({ id: 'title__favorites' }),
            intl.formatMessage({ id: 'transaction__history' }),
          ]}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </Box>
      <Box flex="1">{selectedIndex === 0 ? favorates : history}</Box>
    </Box>
  );
};

export default Mobile;
