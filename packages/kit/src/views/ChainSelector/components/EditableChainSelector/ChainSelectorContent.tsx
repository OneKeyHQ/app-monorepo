import type { Dispatch, SetStateAction } from 'react';
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

import type { ISectionListRef } from '@onekeyhq/components';
import {
  Empty,
  Icon,
  Page,
  SearchBar,
  SectionList,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useFuseSearch } from '../../hooks/useFuseSearch';
import ChainSelectorTooltip from '../ChainSelectorTooltip';
import DottedLine from '../DottedLine';
import RecentNetworks from '../RecentNetworks';

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
      illustration="BlockQuestionMark"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
    />
  );
};

const ListHeaderComponent = () => {
  const intl = useIntl();
  const { allNetworkItem, searchText, zeroValue } = useContext(
    EditableChainSelectorContext,
  );

  if (searchText) {
    return null;
  }

  if (zeroValue && !allNetworkItem) {
    return null;
  }

  return (
    <YStack>
      {zeroValue ? null : (
        <XStack px="$5" py="$3">
          <ChainSelectorTooltip
            renderContent={intl.formatMessage({
              id: ETranslations.network_auto_detection_tip,
            })}
            renderTrigger={
              <Stack>
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.network_found_assets_on_networks,
                  })}
                </SizableText>
                <DottedLine mt={1} />
              </Stack>
            }
          />
        </XStack>
      )}
      {allNetworkItem ? (
        <EditableListItem item={allNetworkItem} isEditable={false} />
      ) : null}
    </YStack>
  );
};

type IEditableChainSelectorContentProps = {
  isEditMode?: boolean;
  recentNetworksEnabled?: boolean;
  accountNetworkValues: Record<string, string>;
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  unavailableItems: IServerNetwork[];
  frequentlyUsedItems: IServerNetwork[];
  allNetworkItem?: IServerNetwork;
  networkId?: string;
  walletId?: string;
  accountId?: string;
  indexedAccountId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onAddCustomNetwork?: () => void;
  onEditCustomNetwork?: (network: IServerNetwork) => void;
  onFrequentlyUsedItemsChange?: (networks: IServerNetwork[]) => void;
  setAllNetworksChanged?: (value: boolean) => void;
  accountNetworkValueCurrency?: string;
  accountDeFiOverview: Record<
    string,
    {
      netWorth: number;
    }
  >;
  showAllNetworkInRecentNetworks?: boolean;
  zeroValue?: boolean;
  searchText?: string;
  setSearchText?: Dispatch<SetStateAction<string>>;
};

export const EditableChainSelectorContent = ({
  recentNetworksEnabled,
  walletId,
  indexedAccountId,
  accountNetworkValues,
  accountNetworkValueCurrency,
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
  accountDeFiOverview,
  showAllNetworkInRecentNetworks,
  zeroValue,
  searchText: searchTextProp,
  setSearchText: setSearchTextProp,
}: IEditableChainSelectorContentProps) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [searchTextLocal, setSearchTextLocal] = useState('');
  const searchText = searchTextProp ?? searchTextLocal;
  const setSearchText = setSearchTextProp ?? setSearchTextLocal;
  const [tempFrequentlyUsedItems, setTempFrequentlyUsedItems] = useState(
    frequentlyUsedItems ?? [],
  );
  const listRef = useRef<ISectionListRef<any> | null>(null);
  const lastIsEditMode = usePrevious(isEditMode);

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
    if (searchText) {
      const data = networkFuseSearch(searchText);
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
      .toSorted((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));

    const _sections: IEditableChainSelectorSection[] = [
      {
        data: tempFrequentlyUsedItems,
        draggable: true,
      },
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
    searchText,
    intl,
    networkFuseSearch,
  ]);

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
      walletId: walletId ?? '',
      indexedAccountId,
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
      searchText,
      allNetworkItem,
      accountNetworkValues,
      accountNetworkValueCurrency,
      accountDeFiOverview,
      zeroValue,
    }),
    [
      walletId,
      indexedAccountId,
      tempFrequentlyUsedItems,
      networkId,
      onPressItem,
      onAddCustomNetwork,
      isEditMode,
      searchText,
      allNetworkItem,
      accountNetworkValues,
      accountNetworkValueCurrency,
      onFrequentlyUsedItemsChange,
      onEditCustomNetwork,
      accountDeFiOverview,
      zeroValue,
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

  // Trigger the initial jump-to-selected once FlashList finishes its
  // first measure pass (onLayout). Using a setTimeout after mount runs
  // too early and FlashList's sticky compute hasn't caught up yet; the
  // ref guard keeps later onLayout fires from re-jumping.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [initialScrollIndex]);
  const handleListLayout = useCallback(() => {
    if (!initialScrollIndex || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    listRef.current?.scrollToLocation?.({
      sectionIndex: initialScrollIndex.sectionIndex,
      itemIndex: initialScrollIndex.itemIndex ?? 0,
      viewPosition: 0,
      animated: false,
    });
  }, [initialScrollIndex]);

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
              // Reset list to the top whenever the user types in search.
              listRef.current?.scrollToLocation?.({
                sectionIndex: 0,
                itemIndex: 0,
                viewPosition: 0,
                animated: false,
              });
              setSearchText(text);
            }}
            {...(!platformEnv.isNative && {
              autoFocus: true,
            })}
          />
        </Stack>
        {recentNetworksEnabled ? (
          <RecentNetworks
            containerProps={{
              mt: '$4',
            }}
            onPressItem={onPressItem}
            availableNetworks={[
              ...mainnetItems,
              ...testnetItems,
              allNetworkItem,
            ].filter(Boolean)}
            showAllNetwork={showAllNetworkInRecentNetworks}
            swrKeyScope="editable-chain-selector"
          />
        ) : null}
        <Stack flex={1}>
          {sections.length > 0 ? (
            <SectionList
              ref={listRef}
              stickySectionHeadersEnabled
              sections={sections}
              renderItem={renderItem}
              keyExtractor={(item) => (item as IServerNetwork).id}
              estimatedItemSize={CELL_HEIGHT}
              ListHeaderComponent={<ListHeaderComponent />}
              renderSectionHeader={renderSectionHeader}
              contentContainerStyle={{ paddingBottom: bottom || 8 }}
              onLayout={handleListLayout}
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
