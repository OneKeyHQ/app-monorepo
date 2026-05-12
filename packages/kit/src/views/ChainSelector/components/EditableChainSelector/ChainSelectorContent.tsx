import type { Dispatch, SetStateAction } from 'react';
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import type { ISectionListRef } from '@onekeyhq/components';
import {
  Empty,
  SearchBar,
  SectionList,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { useAndroidFlashListInitialScrollFix } from '../../hooks/useAndroidFlashListInitialScrollFix';
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

// Passed through to FlashList v2's overrideProps. See SectionList JSX
// below for why we use spread-cast instead of naming the prop directly.
const flashListOverrideProps = {
  overrideProps: { initialDrawBatchSize: 30 },
};

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
      {allNetworkItem ? <EditableListItem item={allNetworkItem} /> : null}
    </YStack>
  );
};

type IEditableChainSelectorContentProps = {
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
  onEditCustomNetwork?: (network: IServerNetwork) => void;
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
  accountId,
  indexedAccountId,
  accountNetworkValues,
  accountNetworkValueCurrency,
  mainnetItems,
  testnetItems,
  frequentlyUsedItems,
  unavailableItems,
  onPressItem,
  onEditCustomNetwork,
  networkId,
  allNetworkItem,
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
  const hasRenderedSectionListRef = useRef(false);

  useLayoutEffect(() => {
    setTempFrequentlyUsedItems(frequentlyUsedItems);
  }, [frequentlyUsedItems]);

  const isFrequentlyUsedItemsSyncing =
    !hasRenderedSectionListRef.current &&
    !searchText.trim() &&
    tempFrequentlyUsedItems !== frequentlyUsedItems;

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

  const shouldRenderList = sections.length > 0 && !isFrequentlyUsedItemsSyncing;
  const shouldRenderEmpty = sections.length === 0;

  useLayoutEffect(() => {
    if (shouldRenderList) {
      hasRenderedSectionListRef.current = true;
    }
  }, [shouldRenderList]);

  // Convert `initialScrollIndex` (section/item) into the flat data index
  // that FlashList (via SectionList) uses for `initialScrollIndex` prop.
  //
  // SectionList flattens `sections` into [Header, Items..., Footer] for
  // section 0, then [Separator, Header, Items..., Footer] for each
  // subsequent section (see @onekeyhq/components/.../SectionList/index.tsx).
  //
  // Passing this as the *initial* scroll index (vs. imperative
  // scrollToLocation after onLayout) lets FlashList v2 set its scroll
  // offset before the first render, so the sticky-header compute runs
  // once with the correct offset. Otherwise we'd observe ~100ms of
  // "B header not stuck yet" because sticky compute depends on a
  // scroll event to settle (StickyHeaders.tsx / useEffect reads
  // getLastScrollOffset which is 0 at mount).
  const initialScrollFlatIndex = useMemo(() => {
    if (!initialScrollIndex || !sections.length) return undefined;
    // Build up to the flat index of the *target section's header*, then
    // add itemIndex. Matches SectionList's own scrollToLocation semantics
    // (index = headerFlatIndex + itemIndex), where itemIndex = 0 lands on
    // the header and itemIndex = 1 on the first item.
    //
    // Landing the scroll on the header (instead of on the selected item's
    // exact row) avoids a FlashList v2 recycler glitch where a cell
    // whose offset equals the scroll offset shows as an empty highlighted
    // row — the section header row right above absorbs the boundary.
    let idx = 0;
    for (let si = 0; si < initialScrollIndex.sectionIndex; si += 1) {
      if (si !== 0) idx += 1; // separator
      idx += 1; // header
      idx += sections[si].data.length;
      idx += 1; // footer
    }
    if (initialScrollIndex.sectionIndex !== 0) idx += 1; // target separator
    // idx now points at the target section's header flat index.
    return idx + (initialScrollIndex.itemIndex ?? 0);
  }, [sections, initialScrollIndex]);

  const { scrollProps: androidScrollProps, onScrollBeginDrag } =
    useAndroidFlashListInitialScrollFix({
      listRef,
      initialIndex: initialScrollFlatIndex,
      enabled: shouldRenderList && !searchText.trim(),
      contentKey: sections,
    });

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
      onEditCustomNetwork,
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
      searchText,
      allNetworkItem,
      accountNetworkValues,
      accountNetworkValueCurrency,
      onEditCustomNetwork,
      accountDeFiOverview,
      zeroValue,
    ],
  );
  const renderItem = useCallback(
    ({
      item,
      section,
    }: {
      item: IServerNetwork;
      section: IEditableChainSelectorSection;
    }) => (
      <EditableListItem
        item={item}
        isDisabled={section.unavailable}
        isCustomNetworkEditable={item.isCustomNetwork}
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
            swrKeyScope={EAppSWRCacheScopes.editableChainSelector}
            walletId={walletId}
            accountId={accountId}
          />
        ) : null}
        <Stack flex={1}>
          {shouldRenderList ? (
            <SectionList
              ref={listRef}
              stickySectionHeadersEnabled
              sections={sections}
              renderItem={renderItem}
              keyExtractor={(item) => (item as IServerNetwork).id}
              estimatedItemSize={CELL_HEIGHT}
              // Set initial scroll before first paint so FlashList's
              // sticky compute runs once at the target offset, instead
              // of briefly sitting at offset=0 and snapping the sticky
              // header into place after the first scroll event.
              initialScrollIndex={initialScrollFlatIndex}
              // FlashList v2 ships with progressive rendering: first
              // paint emits only `initialDrawBatchSize` cells (default
              // 2) and then grows exponentially (2,4,8,16,...) every 5
              // frames. That produces the visible "list fills in row
              // by row" effect on modal open. Bumping this makes the
              // first paint large enough to cover the viewport at
              // initialScrollIndex, so users see a complete list
              // instead of a trickle. `overrideProps` isn't in OneKey's
              // ISectionListProps (the web variant maps to FlatList),
              // so we funnel it through as any.
              {...(flashListOverrideProps as Record<string, unknown>)}
              {...androidScrollProps}
              ListHeaderComponent={<ListHeaderComponent />}
              renderSectionHeader={renderSectionHeader}
              onScrollBeginDrag={onScrollBeginDrag}
              contentContainerStyle={{ paddingBottom: bottom || 8 }}
            />
          ) : null}
          {shouldRenderEmpty ? <ListEmptyComponent /> : null}
        </Stack>
      </Stack>
    </EditableChainSelectorContext.Provider>
  );
};
