import type { FC } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  SearchBar,
  SectionList,
  SortableSectionList,
  Stack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
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

type ISectionItem = {
  title?: string;
  data: IServerNetworkMatch[];
  unavailable?: boolean;
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
  isDisabled,
}: {
  item: IServerNetworkMatch;
  sectionIndex: number;
  drag?: () => void;
  isDisabled?: boolean;
}) => {
  const intl = useIntl();
  const {
    isEditMode,
    networkId,
    topNetworks,
    topNetworkIds,
    onPressItem,
    setTopNetworks,
  } = useContext(EditableViewContext);
  const pinText = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_pin_to_top }),
    [intl],
  );
  const unpinText = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_unpin_from_top }),
    [intl],
  );

  const isDraggable =
    isEditMode &&
    sectionIndex === 0 &&
    item.id !== getNetworkIdsMap().onekeyall;

  const opacity = isDisabled ? 0.7 : 1;

  const onPress = useMemo(() => {
    if (!isEditMode && !isDisabled) {
      return () => onPressItem?.(item);
    }
    return undefined;
  }, [isEditMode, isDisabled, item, onPressItem]);

  return (
    <ListItem
      title={item.name}
      titleMatch={item.titleMatch}
      h={CELL_HEIGHT}
      renderAvatar={<NetworkAvatarBase logoURI={item.logoURI} size="$8" />}
      opacity={opacity}
      onPress={onPress}
    >
      {sectionIndex !== 0 && isEditMode && !isDisabled ? (
        <ListItem.IconButton
          {...ListItem.EnterAnimationStyle}
          onPress={() => {
            if (topNetworkIds.has(item.id)) {
              setTopNetworks?.([
                ...topNetworks.filter((o) => o.id !== item.id),
              ]);
            } else {
              setTopNetworks?.([...topNetworks, item]);
            }
          }}
          title={topNetworkIds.has(item.id) ? unpinText : pinText}
          key="moveToTop"
          icon={
            topNetworkIds.has(item.id) ? 'ThumbtackSolid' : 'ThumbtackOutline'
          }
          iconProps={{
            color: topNetworkIds.has(item.id) ? '$iconActive' : '$iconSubdued',
          }}
        />
      ) : null}
      {networkId === item.id && !isEditMode ? (
        <ListItem.CheckMark key="checkmark" />
      ) : null}
      {isDraggable ? (
        <ListItem.IconButton
          key="darg"
          {...ListItem.EnterAnimationStyle}
          cursor="move"
          icon="DragOutline"
          onPressIn={drag}
        />
      ) : null}
    </ListItem>
  );
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
    />
  );
};

type IEditableViewProps = {
  isEditMode?: boolean;
  unavailableNetworks: IServerNetwork[];
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
  unavailableNetworks,
  isEditMode,
  onTopNetworksChange,
}) => {
  const [searchText, setSearchText] = useState('');
  const [topNetworks, setTopNetworks] = useState(defaultTopNetworks ?? []);
  const intl = useIntl();
  const lastIsEditMode = usePrevious(isEditMode);
  const trimSearchText = searchText.trim();

  useLayoutEffect(() => {
    if (!isEditMode && lastIsEditMode) {
      onTopNetworksChange?.(topNetworks);
    }
  }, [isEditMode, lastIsEditMode, topNetworks, onTopNetworksChange]);

  useLayoutEffect(() => {
    setTopNetworks(defaultTopNetworks);
  }, [defaultTopNetworks]);

  const sections = useMemo<ISectionItem[]>(() => {
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
    const _sections: ISectionItem[] = [{ data: topNetworks }, ...sectionList];
    if (unavailableNetworks.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslationsMock.unavailable_networks_for_selected_account,
        }),
        data: unavailableNetworks,
        unavailable: true,
      });
    }
    return _sections;
  }, [allNetworks, trimSearchText, topNetworks, unavailableNetworks, intl]);
  const layoutList = useMemo(() => {
    let offset = 0;
    const layouts: { offset: number; length: number; index: number }[] = [];
    sections.forEach((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        layouts.push({ offset, length: 20, index: layouts.length });
        offset += 20;
      }
      const headerHeight = section.title ? 36 : 8;
      layouts.push({ offset, length: headerHeight, index: layouts.length });
      offset += headerHeight;
      section.data.forEach(() => {
        layouts.push({ offset, length: CELL_HEIGHT, index: layouts.length });
        offset += CELL_HEIGHT;
      });
      const footerHeight = 0;
      layouts.push({ offset, length: footerHeight, index: layouts.length });
      offset += footerHeight;
    });
    layouts.push({ offset, length: 8, index: layouts.length });
    return layouts;
  }, [sections]);

  const initialScrollIndex = useMemo(() => {
    let _initialScrollIndex:
      | { sectionIndex: number; itemIndex?: number }
      | undefined;
    sections.forEach((section, sectionIndex) => {
      section.data.forEach((item, itemIndex) => {
        if (item.id === networkId && _initialScrollIndex === undefined) {
          _initialScrollIndex = { sectionIndex, itemIndex: itemIndex - 1 };
          if (
            _initialScrollIndex &&
            (_initialScrollIndex?.itemIndex ?? 0) <= 0
          ) {
            _initialScrollIndex.itemIndex = undefined;
          }
        }
      });
    });
    if (
      _initialScrollIndex?.sectionIndex === 0 &&
      (_initialScrollIndex?.itemIndex ?? 0) <= 10
    ) {
      _initialScrollIndex.itemIndex = undefined;
    }
    return _initialScrollIndex;
  }, [sections, networkId]);

  const context = useMemo<IEditableViewContext>(
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
      section: ISectionItem;
      drag?: () => void;
    }) => (
      <EditableViewListItem
        item={item}
        sectionIndex={
          searchText.length > 0
            ? 1
            : sections.findIndex((_section) => _section === section)
        }
        isDisabled={section.unavailable}
        drag={drag}
      />
    ),
    [sections, searchText],
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
    <EditableViewContext.Provider value={context}>
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
          {sections.length > 0 ? (
            <SortableSectionList
              enabled={isEditMode}
              stickySectionHeadersEnabled
              sections={sections}
              renderItem={renderItem}
              keyExtractor={(item) => (item as IServerNetwork).id}
              onDragEnd={(result) => {
                const itemList = result?.sections?.[0]
                  ?.data as IServerNetwork[];
                setTopNetworks(itemList);
              }}
              initialScrollIndex={initialScrollIndex}
              getItemLayout={(item, index) => {
                if (index === -1) {
                  return { index, offset: 0, length: 0 };
                }
                return layoutList[index];
              }}
              renderSectionHeader={renderSectionHeader}
              ListFooterComponent={<Stack h="$2" />} // Act as padding bottom
            />
          ) : (
            <ListEmptyComponent />
          )}
        </Stack>
      </Stack>
    </EditableViewContext.Provider>
  );
};
