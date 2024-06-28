import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { createContext, useContext, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  SearchBar,
  SectionList,
  SortableSectionList,
  Stack,
} from '@onekeyhq/components';
import type { ISortableSectionListRef } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { networkFuseSearch } from '../../utils';

import type { IServerNetworkMatch } from '../../types';

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

const EditableViewListItem = ({
  item,
  sectionIndex,
  drag,
}: {
  item: IServerNetworkMatch;
  sectionIndex: number;
  drag: () => void;
}) => {
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
      titleMatch={item.titleMatch}
      h={CELL_HEIGHT}
      renderAvatar={<NetworkAvatar networkId={item?.id} size="$8" />}
      onPress={!isEditMode ? () => onPressItem?.(item) : undefined}
    >
      {sectionIndex !== 0 && isEditMode ? (
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
      {networkId === item.id && !isEditMode ? (
        <ListItem.CheckMark
          key="checkmark"
          enterStyle={{
            opacity: 0,
            scale: 0,
          }}
        />
      ) : null}
      {isEditMode && sectionIndex === 0 ? (
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
    </ListItem>
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
  const intl = useIntl();
  const lastIsEditMode = usePrevious(isEditMode);
  const trimSearchText = searchText.trim();
  const scrollView = useRef<ISortableSectionListRef>(null);

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
      const data = networkFuseSearch(allNetworks, trimSearchText);
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
    const sectionList = Object.entries(data)
      .map(([key, value]) => ({ title: key, data: value }))
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));
    return [{ data: topNetworks }, ...sectionList];
  }, [allNetworks, trimSearchText, topNetworks]);

  const hasScrollToSelectedCell = useRef(false);
  useEffect(() => {
    if (sections.length <= 1 || hasScrollToSelectedCell.current) {
      return;
    }
    let y = 0;
    for (const section of sections) {
      const index = section.data.findIndex((item) => item.id === networkId);
      if (index !== -1) {
        // eslint-disable-next-line @typescript-eslint/no-loop-func, no-loop-func
        setTimeout(() => {
          y += index * CELL_HEIGHT;
          y -= section.title ? 20 : 0;
          scrollView?.current?.scrollTo?.({
            y,
            animated: false,
          });
          hasScrollToSelectedCell.current = true;
        });
        break;
      }
      y += 36 + 20;
      y += section.data.length * CELL_HEIGHT;
    }
  }, [defaultTopNetworks, sections, networkId]);

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
    ({
      item,
      section,
      drag,
    }: {
      item: IServerNetwork;
      section: { data: IServerNetwork[]; title: string };
      drag: () => void;
    }) => (
      <EditableViewListItem
        item={item}
        sectionIndex={
          searchText.length > 0
            ? 1
            : sections.findIndex((_section) => _section === section)
        }
        drag={drag}
      />
    ),
    [searchText.length, sections],
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
        <Stack px="$5">
          <SearchBar
            placeholder={intl.formatMessage({
              id: ETranslations.global_search,
            })}
            value={searchText}
            onChangeText={(text) => setSearchText(text.trim())}
          />
        </Stack>
        <Stack flex={1}>
          <SortableSectionList
            // @ts-ignore
            ref={scrollView}
            enabled={isEditMode}
            stickySectionHeadersEnabled
            sections={sections}
            renderItem={renderItem}
            keyExtractor={(item) => (item as IServerNetwork).id}
            onDragEnd={(result) => setTopNetworks(result.sections[0].data)}
            getItemLayout={(_, index) => ({
              length: CELL_HEIGHT,
              offset: index * CELL_HEIGHT,
              index,
            })}
            renderSectionHeader={renderSectionHeader}
            ListFooterComponent={<Stack h="$2" />} // Act as padding bottom
          />
        </Stack>
      </Stack>
    </EditableViewContext.Provider>
  );
};
