import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { createContext, useContext } from 'react';

import {
  Empty,
  SectionList,
  SortableListView,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IServerNetwork } from '@onekeyhq/shared/types';

type IListNetworkContext = {
  isEditMode?: boolean;
  searchText?: string;
  selectNetworkId?: string;
  topNetworkIds: Set<string>;
  topNetworks: IServerNetwork[];
  onPressItem?: (item: IServerNetwork) => void;
  setTopNetworks?: (networks: IServerNetwork[]) => void;
};

const ListNetworkContext = createContext<IListNetworkContext>({
  topNetworks: [],
  topNetworkIds: new Set(),
});

type IListNetworkItemProps = {
  item: IServerNetwork;
};

const CELL_HEIGHT = 48;

const ListNetworkItem: FC<IListNetworkItemProps> = ({ item }) => {
  const {
    isEditMode,
    selectNetworkId,
    onPressItem,
    topNetworks,
    topNetworkIds,
    setTopNetworks,
  } = useContext(ListNetworkContext);
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
      {!isEditMode && selectNetworkId === item.id ? (
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

const ListTopNetworks = () => {
  const {
    setTopNetworks,
    isEditMode,
    topNetworks,
    selectNetworkId,
    searchText,
    onPressItem,
  } = useContext(ListNetworkContext);
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
          {!isEditMode && selectNetworkId === item.id ? (
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

type IListNetworkViewProps = {
  isEditMode?: boolean;
  topNetworks: IServerNetwork[];
  allNetworks: IServerNetwork[];
  selectNetworkId?: string;
  searchText?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onChangeTopNetworks?: (networks: IServerNetwork[]) => void;
};

const ListNetworkEmpty = () => (
  <Empty icon="SearchOutline" title="No Results" />
);

export const ListNetworkView: FC<IListNetworkViewProps> = ({
  allNetworks,
  onPressItem,
  selectNetworkId,
  topNetworks: _topNetworks,
  isEditMode,
  searchText,
  onChangeTopNetworks,
}) => {
  const [topNetworks, setTopNetworks] = useState(_topNetworks);
  const lastIsEditMode = usePrevious(isEditMode);

  useEffect(() => {
    if (!isEditMode && lastIsEditMode) {
      onChangeTopNetworks?.(topNetworks);
    }
  }, [isEditMode, lastIsEditMode, topNetworks, onChangeTopNetworks]);

  useEffect(() => {
    setTopNetworks(_topNetworks);
  }, [_topNetworks]);

  const { result: sections } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.groupNetworks({
        networks: allNetworks,
        searchKey: searchText ?? '',
      }),
    [allNetworks, searchText],
    { initResult: [] },
  );
  const ctx = useMemo<IListNetworkContext>(
    () => ({
      topNetworks,
      topNetworkIds: new Set(topNetworks.map((item) => item.id)),
      selectNetworkId,
      onPressItem,
      isEditMode,
      setTopNetworks,
      searchText,
    }),
    [
      topNetworks,
      selectNetworkId,
      onPressItem,
      isEditMode,
      setTopNetworks,
      searchText,
    ],
  );
  const renderItem = useCallback(
    ({ item }: { item: IServerNetwork }) => <ListNetworkItem item={item} />,
    [],
  );

  const renderSectionHeader = useCallback(
    (item: { section: { title: string } }) => (
      <SectionList.SectionHeader title={item?.section?.title} />
    ),
    [],
  );

  return (
    <ListNetworkContext.Provider value={ctx}>
      <SectionList
        ListHeaderComponent={ListTopNetworks}
        sections={sections}
        estimatedItemSize="$12"
        renderItem={renderItem}
        keyExtractor={(item) => (item as IServerNetwork).id}
        ListEmptyComponent={ListNetworkEmpty}
        renderSectionHeader={renderSectionHeader}
        ListFooterComponent={<Stack h="$2" />} // Act as padding bottom
      />
    </ListNetworkContext.Provider>
  );
};
