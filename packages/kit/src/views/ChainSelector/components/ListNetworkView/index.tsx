import { type FC, useCallback, useMemo } from 'react';
import { createContext, useContext } from 'react';

import { Empty, SectionList, SortableListView } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { filterNetworks, groupNetworks } from '../../utils';

type IListNetworkContext = {
  isEditMode?: boolean;
  searchText?: string;
  selectNetworkId?: string;
  topNetworkIds: Set<string>;
  topNetworks: IServerNetwork[];
  onPressItem?: (item: IServerNetwork) => void;
  onChangeTopNetworks?: (networks: IServerNetwork[]) => void;
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
    onChangeTopNetworks,
  } = useContext(ListNetworkContext);
  return (
    <ListItem
      title={item.name}
      h={CELL_HEIGHT}
      avatarProps={{
        src: item.logoURI,
        size: '$8',
      }}
      {...{ onPress: !isEditMode ? () => onPressItem?.(item) : undefined }}
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
              onChangeTopNetworks?.([
                ...topNetworks.filter((o) => o.id !== item.id),
              ]);
            } else {
              onChangeTopNetworks?.([...topNetworks, item]);
            }
          }}
          title="Move to top"
          key="moveToTop"
          animation="quick"
          enterStyle={{
            opacity: 0,
            scale: 0,
          }}
          icon={
            topNetworkIds.has(item.id) ? 'ThumbtackSolid' : 'ThumbtackOutline'
          }
        />
      ) : null}
    </ListItem>
  );
};

const ListTopNetworks = () => {
  const {
    onChangeTopNetworks,
    isEditMode,
    topNetworks,
    selectNetworkId,
    searchText,
    onPressItem,
  } = useContext(ListNetworkContext);
  const networks = useMemo(
    () => filterNetworks(topNetworks, searchText ?? ''),
    [topNetworks, searchText],
  );
  if (isEditMode && searchText) {
    return null;
  }
  return (
    <SortableListView
      data={networks}
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
          {...{ onPress: !isEditMode ? () => onPressItem?.(item) : undefined }}
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
      onDragEnd={(result) => onChangeTopNetworks?.(result.data)}
      scrollEnabled={false}
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
  onChangeTopNetworks,
  selectNetworkId,
  topNetworks,
  isEditMode,
  searchText,
}) => {
  const sections = useMemo(
    () => groupNetworks(filterNetworks(allNetworks, searchText ?? '')),
    [allNetworks, searchText],
  );
  const ctx = useMemo<IListNetworkContext>(
    () => ({
      topNetworks,
      topNetworkIds: new Set(topNetworks.map((item) => item.id)),
      selectNetworkId,
      onPressItem,
      isEditMode,
      onChangeTopNetworks,
      searchText,
    }),
    [
      topNetworks,
      selectNetworkId,
      onPressItem,
      isEditMode,
      onChangeTopNetworks,
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
      />
    </ListNetworkContext.Provider>
  );
};
