import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { createContext, useContext } from 'react';

import {
  Empty,
  SearchBar,
  SectionList,
  SortableListView,
  Stack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { filterNetwork } from '../BaseView';

type IEditableViewContext = {
  isEditMode?: boolean;
  networkId?: string;
  searchText?: string;
  topNetworkIds: Set<string>;
  topNetworks: IServerNetwork[];
  onPressItem?: (item: IServerNetwork) => void;
  setTopNetworks?: (networks: IServerNetwork[]) => void;
};

const EditableViewContext = createContext<IEditableViewContext>({
  topNetworks: [],
  topNetworkIds: new Set(),
});

const CELL_HEIGHT = 48;

const EditableViewListItem = ({ item }: { item: IServerNetwork }) => {
  const {
    isEditMode,
    networkId,
    topNetworks,
    topNetworkIds,
    onPressItem,
    setTopNetworks,
  } = useContext(EditableViewContext);
  return (
    <ListItem
      title={item.name}
      h={CELL_HEIGHT}
      renderAvatar={<NetworkAvatar networkId={item?.id} size="$8" />}
      onPress={!isEditMode ? () => onPressItem?.(item) : undefined}
    >
      {!isEditMode && networkId === item.id ? (
        <ListItem.CheckMark
          key="checkmark"
          enterStyle={{
            opacity: 0,
            scale: 0,
          }}
        />
      ) : null}
      {isEditMode ? (
        <ListItem.IconButton
          onPress={() => {
            if (topNetworkIds.has(item.id)) {
              setTopNetworks?.([
                ...topNetworks.filter((o) => o.id !== item.id),
              ]);
            } else {
              setTopNetworks?.([...topNetworks, item]);
            }
          }}
          title={topNetworkIds.has(item.id) ? 'Unpin' : 'Pin'}
          key="moveToTop"
          animation="quick"
          enterStyle={{
            opacity: 0,
            scale: 0,
          }}
          icon={
            topNetworkIds.has(item.id) ? 'ThumbtackSolid' : 'ThumbtackOutline'
          }
          iconProps={{
            color: topNetworkIds.has(item.id) ? '$iconActive' : '$iconSubdued',
          }}
        />
      ) : null}
    </ListItem>
  );
};

const ListHeaderComponent = () => {
  const {
    setTopNetworks,
    isEditMode,
    topNetworks,
    networkId,
    searchText,
    onPressItem,
  } = useContext(EditableViewContext);
  const networks = useMemo(
    () => topNetworks.filter(filterNetwork(searchText?.trim() ?? '')),
    [topNetworks, searchText],
  );
  if (searchText) {
    return null;
  }
  return (
    <SortableListView
      data={networks}
      enabled={isEditMode}
      keyExtractor={(item) => `${item.id}`}
      getItemLayout={(_, index) => ({
        length: CELL_HEIGHT,
        offset: index * CELL_HEIGHT,
        index,
      })}
      renderItem={({ item, drag }) => (
        <ListItem
          h={CELL_HEIGHT}
          renderAvatar={<NetworkAvatar networkId={item?.id} size="$8" />}
          title={item.name}
          onPress={!isEditMode ? () => onPressItem?.(item) : undefined}
        >
          {isEditMode ? (
            <ListItem.IconButton
              key="darg"
              animation="quick"
              enterStyle={{
                opacity: 0,
                scale: 0,
              }}
              cursor="move"
              icon="DragOutline"
              onPressIn={drag}
            />
          ) : null}
          {!isEditMode && networkId === item.id ? (
            <ListItem.CheckMark
              key="checkmark"
              enterStyle={{
                opacity: 0,
                scale: 0,
              }}
            />
          ) : null}
        </ListItem>
      )}
      onDragEnd={(result) => setTopNetworks?.(result.data)}
      scrollEnabled={false}
      ListHeaderComponent={<Stack h="$2" />}
      ListFooterComponent={<Stack h="$5" />} // Act as padding bottom
    />
  );
};

type IEditableViewProps = {
  isEditMode?: boolean;
  defaultTopNetworks: IServerNetwork[];
  allNetworks: IServerNetwork[];
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onTopNetworksChange?: (networks: IServerNetwork[]) => void;
};

const ListEmptyComponent = () => (
  <Empty icon="SearchOutline" title="No Results" />
);

export const EditableView: FC<IEditableViewProps> = ({
  allNetworks,
  onPressItem,
  networkId,
  defaultTopNetworks,
  isEditMode,
  onTopNetworksChange,
}) => {
  const [searchText, setSearchText] = useState('');
  const [topNetworks, setTopNetworks] = useState(defaultTopNetworks ?? []);
  const lastIsEditMode = usePrevious(isEditMode);
  const trimSearchText = searchText.trim();

  useEffect(() => {
    if (!isEditMode && lastIsEditMode) {
      onTopNetworksChange?.(topNetworks);
    }
  }, [isEditMode, lastIsEditMode, topNetworks, onTopNetworksChange]);

  useEffect(() => {
    setTopNetworks(defaultTopNetworks);
  }, [defaultTopNetworks]);

  const sections = useMemo<{ title?: string; data: IServerNetwork[] }[]>(() => {
    if (trimSearchText) {
      const data = allNetworks.filter(
        filterNetwork(trimSearchText.toLowerCase(), true),
      );
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }
    const data = allNetworks.reduce((result, item) => {
      const char = item.name[0].toUpperCase();
      if (!result[char]) {
        result[char] = [];
      }
      result[char].push(item);

      return result;
    }, {} as Record<string, IServerNetwork[]>);
    return Object.entries(data)
      .map(([key, value]) => ({ title: key, data: value }))
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));
  }, [allNetworks, trimSearchText]);

  const ctx = useMemo<IEditableViewContext>(
    () => ({
      topNetworks,
      topNetworkIds: new Set(topNetworks.map((item) => item.id)),
      networkId,
      onPressItem,
      isEditMode,
      setTopNetworks,
      searchText: trimSearchText,
    }),
    [
      topNetworks,
      networkId,
      onPressItem,
      isEditMode,
      setTopNetworks,
      trimSearchText,
    ],
  );
  const renderItem = useCallback(
    ({ item }: { item: IServerNetwork }) => (
      <EditableViewListItem item={item} />
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    (item: { section: { title: string } }) => {
      if (item?.section?.title) {
        return <SectionList.SectionHeader title={item?.section?.title} />;
      }
      return <Stack h="$2" />;
    },
    [],
  );

  return (
    <EditableViewContext.Provider value={ctx}>
      <Stack flex={1}>
        <Stack px="$4">
          <SearchBar
            w="100%"
            placeholder="Search"
            value={searchText}
            onChangeText={(text) => setSearchText(text.trim())}
          />
        </Stack>
        <Stack flex={1}>
          <SectionList
            ListHeaderComponent={ListHeaderComponent}
            sections={sections}
            estimatedItemSize="$12"
            renderItem={renderItem}
            keyExtractor={(item) => (item as IServerNetwork).id}
            ListEmptyComponent={ListEmptyComponent}
            renderSectionHeader={renderSectionHeader}
            ListFooterComponent={<Stack h="$2" />} // Act as padding bottom
          />
        </Stack>
      </Stack>
    </EditableViewContext.Provider>
  );
};
