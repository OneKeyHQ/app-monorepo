import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  SearchBar,
  SectionList,
  SortableSectionList,
  Stack,
} from '@onekeyhq/components';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { networkFuseSearch } from '../../utils';

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
  if (!allNetworkItem || searchText?.trim()) return null;
  return <EditableListItem item={allNetworkItem} isEditable={false} />;
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
  onFrequentlyUsedItemsChange?: (networks: IServerNetwork[]) => void;
};

export const EditableChainSelectorContent = ({
  mainnetItems,
  testnetItems,
  frequentlyUsedItems,
  unavailableItems,
  onPressItem,
  networkId,
  isEditMode,
  allNetworkItem,
  onFrequentlyUsedItemsChange,
}: IEditableChainSelectorContentProps) => {
  const intl = useIntl();
  const [searchText, setSearchText] = useState('');
  const [tempFrequentlyUsedItems, setTempFrequentlyUsedItems] = useState(
    frequentlyUsedItems ?? [],
  );
  const lastIsEditMode = usePrevious(isEditMode);
  const searchTextTrim = searchText.trim();

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

  const sections = useMemo<IEditableChainSelectorSection[]>(() => {
    if (searchTextTrim) {
      const networks = [...mainnetItems, ...testnetItems];
      if (allNetworkItem) {
        networks.unshift(allNetworkItem);
      }
      const data = networkFuseSearch(networks, searchTextTrim);
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }
    const data = mainnetItems.reduce((result, item) => {
      const char = item.name[0].toUpperCase();
      if (!result[char]) {
        result[char] = [];
      }
      result[char].push(item);

      return result;
    }, {} as Record<string, IServerNetwork[]>);

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
          id: ETranslationsMock.testnet,
        }),
        data: testnetItems,
      });
    }
    if (unavailableItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslationsMock.unavailable_networks_for_selected_account,
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
    allNetworkItem,
  ]);

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

  const context = useMemo<IEditableChainSelectorContext>(
    () => ({
      frequentlyUsedItems: tempFrequentlyUsedItems,
      setFrequentlyUsedItems: setTempFrequentlyUsedItems,
      frequentlyUsedItemsIds: new Set(
        tempFrequentlyUsedItems.map((item) => item.id),
      ),
      networkId,
      onPressItem,
      isEditMode,
      searchText: searchTextTrim,
      allNetworkItem,
    }),
    [
      tempFrequentlyUsedItems,
      setTempFrequentlyUsedItems,
      networkId,
      onPressItem,
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
    }: {
      item: IServerNetwork;
      section: IEditableChainSelectorSection;
      drag?: () => void;
    }) => (
      <EditableListItem
        item={item}
        isDraggable={section.draggable}
        isDisabled={section.unavailable}
        isEditable={section.editable}
        drag={drag}
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
                setTempFrequentlyUsedItems(itemList);
              }}
              initialScrollIndex={initialScrollIndex}
              getItemLayout={(item, index) => {
                if (index === -1) {
                  return { index, offset: 0, length: 0 };
                }
                return layoutList[index];
              }}
              SectionSeparatorComponent={null}
              ListHeaderComponent={ListHeaderComponent}
              renderSectionHeader={renderSectionHeader}
              ListFooterComponent={<Stack h="$2" />} // Act as padding bottom
            />
          ) : (
            <ListEmptyComponent />
          )}
        </Stack>
      </Stack>
    </EditableChainSelectorContext.Provider>
  );
};
