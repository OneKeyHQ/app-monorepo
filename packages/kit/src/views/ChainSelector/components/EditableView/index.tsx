import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { createContext, useContext } from 'react';

import {
  Empty,
  SearchBar,
  SectionList,
  SortableListView,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IServerNetwork } from '@onekeyhq/shared/types';

type IEditableViewContext = {
  isEditMode?: boolean;
  searchText?: string;
  defaultNetworkId?: string;
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
    defaultNetworkId,
    topNetworks,
    topNetworkIds,
    onPressItem,
    setTopNetworks,
  } = useContext(EditableViewContext);
  return (
    <ListItem
      title={item.name}
      h={CELL_HEIGHT}
      avatarProps={{
        src: item.logoURI,
        size: '$8',
      }}
      onPress={!isEditMode ? () => onPressItem?.(item) : undefined}
    >
      {!isEditMode && defaultNetworkId === item.id ? (
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
    defaultNetworkId,
    searchText,
    onPressItem,
  } = useContext(EditableViewContext);
  const networks = useMemo(() => {
    if (!searchText) {
      return topNetworks;
    }
    return topNetworks.filter((item) => {
      const name = item.name.toLowerCase();
      const shortname = item.shortname.toLowerCase();
      return shortname.includes(searchText) || name.includes(searchText);
    });
  }, [topNetworks, searchText]);
  if (isEditMode && searchText) {
    return null;
  }
  if (isEditMode && searchText) {
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
          avatarProps={{
            src: item.logoURI,
            size: '$8',
          }}
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
          {!isEditMode && defaultNetworkId === item.id ? (
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
      ListFooterComponent={<Stack h="$5" />} // Act as padding bottom
    />
  );
};

type IEditableViewProps = {
  isEditMode?: boolean;
  defaultTopNetworks: IServerNetwork[];
  allNetworks: IServerNetwork[];
  defaultNetworkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onTopNetworksChange?: (networks: IServerNetwork[]) => void;
};

const ListEmptyComponent = () => (
  <Empty icon="SearchOutline" title="No Results" />
);

export const EditableView: FC<IEditableViewProps> = ({
  allNetworks,
  onPressItem,
  defaultNetworkId,
  defaultTopNetworks,
  isEditMode,
  onTopNetworksChange,
}) => {
  const [searchText, setSearchText] = useState('');
  const [topNetworks, setTopNetworks] = useState(defaultTopNetworks ?? []);
  const lastIsEditMode = usePrevious(isEditMode);

  useEffect(() => {
    if (!isEditMode && lastIsEditMode) {
      onTopNetworksChange?.(topNetworks);
    }
  }, [isEditMode, lastIsEditMode, topNetworks, onTopNetworksChange]);

  useEffect(() => {
    setTopNetworks(defaultTopNetworks);
  }, [defaultTopNetworks]);

  const { result: sections } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.groupNetworks({
        networks: allNetworks,
        searchKey: searchText ?? '',
      }),
    [allNetworks, searchText],
    { initResult: [] },
  );
  const ctx = useMemo<IEditableViewContext>(
    () => ({
      topNetworks,
      topNetworkIds: new Set(topNetworks.map((item) => item.id)),
      defaultNetworkId,
      onPressItem,
      isEditMode,
      setTopNetworks,
      searchText,
    }),
    [
      topNetworks,
      defaultNetworkId,
      onPressItem,
      isEditMode,
      setTopNetworks,
      searchText,
    ],
  );
  const renderItem = useCallback(
    ({ item }: { item: IServerNetwork }) => (
      <EditableViewListItem item={item} />
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    (item: { section: { title: string } }) => (
      <SectionList.SectionHeader title={item?.section?.title} />
    ),
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
