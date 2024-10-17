import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ISortableSectionListRef } from '@onekeyhq/components';
import {
  Empty,
  Icon,
  Page,
  SearchBar,
  SectionList,
  SortableSectionList,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { ETranslations } from '@onekeyhq/shared/src/locale';
// import platformEnv from '@onekeyhq/shared/src/platformEnv';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useFuseSearch } from '../../hooks/useFuseSearch';

import { EditableChainSelectorContext } from './context';
import { EditableListItem } from './EditableListItem';
import { CELL_HEIGHT } from './type';

import type {
  IEditableChainSelectorContext,
  IEditableChainSelectorSection,
} from './type';

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

const ListHeaderComponent = () => {
  const { allNetworkItem, searchText } = useContext(
    EditableChainSelectorContext,
  );
  return (
    <Stack mt="$2">
      {!allNetworkItem || searchText?.trim() ? null : (
        <EditableListItem item={allNetworkItem} isEditable={false} />
      )}
    </Stack>
  );
};

type IEditableChainSelectorContentProps = {
  isEditMode?: boolean;
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  unavailableItems: IServerNetwork[];
  frequentlyUsedItems: IServerNetwork[];
  allNetworkItem?: IServerNetwork;
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onAddCustomNetwork?: () => void;
  onEditCustomNetwork?: (network: IServerNetwork) => void;
  onFrequentlyUsedItemsChange?: (networks: IServerNetwork[]) => void;
};

export const EditableChainSelectorContent = ({
  mainnetItems,
  testnetItems,
  frequentlyUsedItems,
  unavailableItems,
  onPressItem,
  onAddCustomNetwork,
  onEditCustomNetwork,
  networkId,
  isEditMode,
  allNetworkItem,
  onFrequentlyUsedItemsChange,
}: IEditableChainSelectorContentProps) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [tempFrequentlyUsedItems, setTempFrequentlyUsedItems] = useState(
    frequentlyUsedItems ?? [],
  );
  const listRef = useRef<ISortableSectionListRef<any> | null>(null);
  const lastIsEditMode = usePrevious(isEditMode);
  const searchTextTrim = searchText.trim();
  const showAllNetworkHeader = useMemo(
    () => (allNetworkItem && !searchText?.trim?.()) ?? true,
    [allNetworkItem, searchText],
  );

  useEffect(() => {
    if (!isEditMode && lastIsEditMode) {
      onFrequentlyUsedItemsChange?.(tempFrequentlyUsedItems);
    }
  }, [
    isEditMode,
    lastIsEditMode,
    tempFrequentlyUsedItems,
    onFrequentlyUsedItemsChange,
  ]);

  useEffect(() => {
    setTempFrequentlyUsedItems(frequentlyUsedItems);
  }, [frequentlyUsedItems]);

  const networksToSearch = useMemo<IServerNetwork[]>(() => {
    const networks = [...mainnetItems, ...testnetItems];
    if (allNetworkItem) {
      networks.unshift(allNetworkItem);
    }
    return networks;
  }, [mainnetItems, testnetItems, allNetworkItem]);

  const networkFuseSearch = useFuseSearch(networksToSearch);

  const sections = useMemo<IEditableChainSelectorSection[]>(() => {
    if (searchTextTrim) {
      const data = networkFuseSearch(searchTextTrim);
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }

    const tempFrequentlyUsedItemsSet = new Set(
      tempFrequentlyUsedItems.map((o) => o.id),
    );
    const filterFrequentlyUsedNetworks = (inputs: IServerNetwork[]) =>
      inputs.filter((o) => !tempFrequentlyUsedItemsSet.has(o.id));

    const data = filterFrequentlyUsedNetworks(mainnetItems).reduce(
      (result, item) => {
        const char = item.name[0].toUpperCase();
        if (!result[char]) {
          result[char] = [];
        }
        result[char].push(item);

        return result;
      },
      {} as Record<string, IServerNetwork[]>,
    );

    const mainnetSections = Object.entries(data)
      .map(([key, value]) => ({ title: key, data: value }))
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));

    const _sections: IEditableChainSelectorSection[] = [
      { data: tempFrequentlyUsedItems, draggable: true },
      ...mainnetSections,
    ];

    if (testnetItems && testnetItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.global_testnet,
        }),
        data: filterFrequentlyUsedNetworks(testnetItems),
      });
    }
    if (unavailableItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.network_selector_unavailable_networks,
        }),
        data: unavailableItems,
        unavailable: true,
      });
    }
    return _sections;
  }, [
    mainnetItems,
    testnetItems,
    tempFrequentlyUsedItems,
    unavailableItems,
    searchTextTrim,
    intl,
    networkFuseSearch,
  ]);

  const dragItemOverflowHitSlop = useMemo(() => {
    const dragCount = tempFrequentlyUsedItems.length;
    if (dragCount <= 0) {
      return undefined;
    }
    return { bottom: (dragCount + 1) * CELL_HEIGHT + 8 };
  }, [tempFrequentlyUsedItems]);

  const layoutList = useMemo(() => {
    let offset = 8 + (showAllNetworkHeader ? CELL_HEIGHT : 0);
    const layouts: { offset: number; length: number; index: number }[] = [];
    sections.forEach((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        layouts.push({ offset, length: 20, index: layouts.length });
        offset += 20;
      }
      const headerHeight = section.title ? 36 : 0;
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
  }, [sections, showAllNetworkHeader]);

  const initialScrollIndex = useMemo(() => {
    if (searchText.trim() || tempFrequentlyUsedItems !== frequentlyUsedItems) {
      return undefined;
    }
    let _initialScrollIndex:
      | { sectionIndex: number; itemIndex?: number }
      | undefined;
    sections.forEach((section, sectionIndex) => {
      section.data.forEach((item, itemIndex) => {
        if (item.id === networkId && _initialScrollIndex === undefined) {
          _initialScrollIndex = {
            sectionIndex,
            itemIndex: itemIndex - ((section?.title?.length ?? 0) > 0 ? 1 : 0),
          };
          if (
            _initialScrollIndex &&
            _initialScrollIndex.itemIndex !== undefined
          ) {
            // if (!platformEnv.isNative) {
            //   _initialScrollIndex.itemIndex += 1;
            // }
            const _itemIndex = _initialScrollIndex?.itemIndex ?? 0;
            if (_itemIndex === -1) {
              _initialScrollIndex.itemIndex = undefined;
            }
            if (
              _itemIndex === section.data.length &&
              sectionIndex !== sections.length - 1
            ) {
              _initialScrollIndex.sectionIndex += 1;
              _initialScrollIndex.itemIndex = undefined;
            }
          }
        }
      });
    });
    if (
      _initialScrollIndex?.sectionIndex !== undefined &&
      sections
        .slice(0, _initialScrollIndex.sectionIndex)
        .reduce((prev, section) => prev + section.data.length, 0) +
        (_initialScrollIndex?.itemIndex ?? 0) <=
        7
    ) {
      return { sectionIndex: 0, itemIndex: undefined };
    }
    return _initialScrollIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, networkId, searchText]);

  const context = useMemo<IEditableChainSelectorContext>(
    () => ({
      frequentlyUsedItems: tempFrequentlyUsedItems,
      setFrequentlyUsedItems: setTempFrequentlyUsedItems,
      frequentlyUsedItemsIds: new Set(
        tempFrequentlyUsedItems.map((item) => item.id),
      ),
      networkId,
      onPressItem,
      onAddCustomNetwork,
      onEditCustomNetwork: (network: IServerNetwork) => {
        // Save list edits before editing custom network
        onFrequentlyUsedItemsChange?.(tempFrequentlyUsedItems);
        onEditCustomNetwork?.(network);
      },
      isEditMode,
      searchText: searchTextTrim,
      allNetworkItem,
    }),
    [
      tempFrequentlyUsedItems,
      setTempFrequentlyUsedItems,
      networkId,
      onPressItem,
      onAddCustomNetwork,
      onEditCustomNetwork,
      onFrequentlyUsedItemsChange,
      isEditMode,
      searchTextTrim,
      allNetworkItem,
    ],
  );
  const renderItem = useCallback(
    ({
      item,
      section,
      drag,
      dragProps,
    }: {
      item: IServerNetwork;
      section: IEditableChainSelectorSection;
      drag?: () => void;
      dragProps?: Record<string, any>;
    }) => (
      <EditableListItem
        item={item}
        isDraggable={section.draggable}
        isDisabled={section.unavailable}
        isEditable={section.editable}
        isCustomNetworkEditable={item.isCustomNetwork}
        drag={drag}
        dragProps={dragProps}
      />
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    (item: { section: IEditableChainSelectorSection }) => {
      if (item.section.title) {
        return <SectionList.SectionHeader title={item.section.title} />;
      }
      return <Stack />;
    },
    [],
  );

  return (
    <EditableChainSelectorContext.Provider value={context}>
      <Stack flex={1} position="relative">
        <Stack px="$5">
          <SearchBar
            testID="chain-selector"
            placeholder={intl.formatMessage({
              id: ETranslations.global_search,
            })}
            value={searchText}
            onChangeText={(text) => {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
              listRef?.current?._listRef?._scrollRef?.scrollTo?.({
                y: 0,
                animated: false,
              });
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (listRef?.current?._listRef?._hasDoneInitialScroll) {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                listRef.current._listRef._hasDoneInitialScroll = false;
              }
              setSearchText(text.trim());
            }}
            {...(!platformEnv.isNative && {
              autoFocus: true,
            })}
          />
        </Stack>
        <Stack flex={1}>
          {sections.length > 0 ? (
            <SortableSectionList
              ref={listRef}
              enabled={isEditMode}
              stickySectionHeadersEnabled
              sections={sections}
              renderItem={renderItem}
              keyExtractor={(item) => (item as IServerNetwork).id}
              onDragEnd={(result) => {
                const itemList = result?.sections?.[0]
                  ?.data as IServerNetwork[];
                setTempFrequentlyUsedItems(itemList);
              }}
              initialScrollIndex={initialScrollIndex}
              dragItemOverflowHitSlop={dragItemOverflowHitSlop}
              getItemLayout={(_, index) => {
                if (index === -1) {
                  return {
                    index,
                    offset: showAllNetworkHeader ? 56 : 0,
                    length: 0,
                  };
                }
                return layoutList[index];
              }}
              ListHeaderComponent={ListHeaderComponent}
              renderSectionHeader={renderSectionHeader}
              ListFooterComponent={
                <>
                  {isEditMode ? <Stack h="$2" /> : <Stack h={bottom || '$2'} />}
                </>
              } // Act as padding bottom
            />
          ) : (
            <ListEmptyComponent />
          )}
        </Stack>
        {isEditMode ? (
          <Page.Footer>
            <Stack
              pt="$2"
              pb={bottom || '$2'}
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="$borderSubdued"
            >
              <ListItem
                userSelect="none"
                onPress={() => onAddCustomNetwork?.()}
              >
                <Stack p="$1" borderRadius="$full" bg="$bgStrong">
                  <Icon name="PlusSmallOutline" color="$iconSubdued" />
                </Stack>
                <ListItem.Text
                  primary={intl.formatMessage({
                    id: ETranslations.custom_network_add_network_action_text,
                  })}
                />
              </ListItem>
            </Stack>
          </Page.Footer>
        ) : null}
      </Stack>
    </EditableChainSelectorContext.Provider>
  );
};
