import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useIntl } from 'react-intl';

import {
  type IListViewRef,
  Icon,
  ListView,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ScrollableFilterBar,
  useScrollableFilterBar,
} from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpTokenSelectorConfigPersistAtom,
  usePerpTokenSelectorTabsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPerpTokenSelectorConfig,
  IPerpTokenSortField,
  IPerpsAssetCtx,
  IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid';
import {
  DEFAULT_PERP_TOKEN_ACTIVE_TAB,
  DEFAULT_PERP_TOKEN_SORT_DIRECTION,
  DEFAULT_PERP_TOKEN_SORT_FIELD,
  XYZ_ASSET_ID_OFFSET,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  type IFavoriteItem,
  usePerpActiveTabValidation,
  usePerpTokenSelector,
  usePerpsFavorites,
} from '../../hooks';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { FavoritesEmptyState } from './FavoritesEmptyState';
import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';

import type { ITokenSelectorListItem } from './PerpTokenSelector';
import type { LayoutChangeEvent } from 'react-native';

const TabItem = memo(
  ({
    id,
    name,
    isFocused,
    onPress,
  }: {
    id: string;
    name: string;
    isFocused: boolean;
    onPress: (id: string) => void;
  }) => {
    const { handleItemLayout } = useScrollableFilterBar();
    const handlePress = useCallback(() => onPress(id), [id, onPress]);
    return (
      <XStack
        alignItems="center"
        justifyContent="center"
        px="$2.5"
        py="$1.5"
        borderRadius="$full"
        userSelect="none"
        cursor="default"
        backgroundColor={isFocused ? '$bgActive' : '$transparent'}
        onPress={handlePress}
        onLayout={(event: LayoutChangeEvent) => handleItemLayout(id, event)}
      >
        <SizableText
          numberOfLines={1}
          size="$bodyMdMedium"
          color={isFocused ? '$text' : '$textSubdued'}
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);
TabItem.displayName = 'TabItem';

function MobileTokenSelectorModal({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useHyperliquidActions();
  const { searchQuery, setSearchQuery } = usePerpTokenSelector();

  const handleSelectToken = useCallback(
    async (symbol: string) => {
      try {
        onLoadingChange(true);
        navigation.popStack();
        await actions.current.changeActiveAsset({ coin: symbol });
      } catch (error) {
        console.error('Failed to switch token:', error);
      } finally {
        onLoadingChange(false);
      }
    },
    [onLoadingChange, navigation, actions],
  );

  const [{ assetsByDex }] = usePerpsAllAssetsFilteredAtom();
  const [{ assetCtxsByDex }] = usePerpsAllAssetCtxsAtom();
  const { favoriteItems, isReady: isFavoritesReady } = usePerpsFavorites();
  const [selectorConfig, setSelectorConfig] =
    usePerpTokenSelectorConfigPersistAtom();
  const [dynamicTabsRaw] = usePerpTokenSelectorTabsAtom();
  const dynamicTabs = useMemo(() => dynamicTabsRaw ?? [], [dynamicTabsRaw]);
  const activeTab = selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const listRef = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);

  // Freeze sort order; only refresh on sort/tab change or first data arrival.
  const ctxSnapshotRef = useRef(assetCtxsByDex);
  const lastSortRef = useRef<{
    field?: string;
    direction?: string;
    activeTab?: string;
  } | null>(null);
  useEffect(() => {
    const field = selectorConfig?.field;
    const direction = selectorConfig?.direction;
    const currentTab = selectorConfig?.activeTab;
    const last = lastSortRef.current;
    const sortChanged =
      last?.field !== field ||
      last?.direction !== direction ||
      last?.activeTab !== currentTab;
    // Also refresh when snapshot is empty (first WS data arrival after mount)
    const snapshotEmpty = !ctxSnapshotRef.current?.some(
      (arr) => arr?.length > 0,
    );
    if (!sortChanged && !snapshotEmpty) {
      return;
    }
    lastSortRef.current = { field, direction, activeTab: currentTab };
    ctxSnapshotRef.current = assetCtxsByDex;
  }, [
    selectorConfig?.direction,
    selectorConfig?.field,
    selectorConfig?.activeTab,
    assetCtxsByDex,
  ]);

  // Container-level mark instead of per-row
  useEffect(() => {
    actions.current.markAllAssetCtxsRequired();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      actions.current.markAllAssetCtxsNotRequired();
    };
  }, [actions]);

  const tabLabels = useMemo(
    () => ({
      favorites: intl.formatMessage({ id: ETranslations.perp_tab_favs }),
      all: intl.formatMessage({ id: ETranslations.perps_token_selector_perps }),
    }),
    [intl],
  );
  const setActiveTab = useCallback(
    (tab: string) => {
      startTransition(() => {
        setSelectorConfig((prev) => ({
          field: prev?.field ?? DEFAULT_PERP_TOKEN_SORT_FIELD,
          direction: prev?.direction ?? DEFAULT_PERP_TOKEN_SORT_DIRECTION,
          activeTab: tab,
        }));
      });
    },
    [setSelectorConfig],
  );

  const computeSortValues = useCallback(
    (assetCtx: IPerpsAssetCtx | undefined) => {
      const markPrice = Number(assetCtx?.markPx || 0);
      const fundingRate = Number(assetCtx?.funding || 0);
      const volume24h = Number(assetCtx?.dayNtlVlm || 0);
      const openInterest = Number(assetCtx?.openInterest || 0);
      const prevDayPx = Number(assetCtx?.prevDayPx || 0);
      const change24hPercent =
        prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;
      const openInterestValue = openInterest * markPrice;
      return {
        markPrice,
        fundingRate,
        volume24h,
        openInterest,
        openInterestValue,
        change24hPercent,
      };
    },
    [],
  );

  const sortCompare = useCallback(
    (
      a: {
        asset: IPerpsUniverse;
        sortValues: ReturnType<typeof computeSortValues>;
      },
      b: {
        asset: IPerpsUniverse;
        sortValues: ReturnType<typeof computeSortValues>;
      },
    ) => {
      const sortField = selectorConfig?.field ?? '';
      const sortDirection = selectorConfig?.direction ?? 'desc';
      if (!sortField) {
        return 0;
      }
      let compareResult = 0;
      switch (sortField) {
        case 'name':
          compareResult = a.asset.name.localeCompare(b.asset.name, undefined, {
            sensitivity: 'base',
          });
          break;
        case 'markPrice':
          compareResult = a.sortValues.markPrice - b.sortValues.markPrice;
          break;
        case 'change24hPercent':
          compareResult =
            a.sortValues.change24hPercent - b.sortValues.change24hPercent;
          break;
        case 'fundingRate':
          compareResult = a.sortValues.fundingRate - b.sortValues.fundingRate;
          break;
        case 'volume24h':
          compareResult = a.sortValues.volume24h - b.sortValues.volume24h;
          break;
        case 'openInterest':
          compareResult =
            a.sortValues.openInterestValue - b.sortValues.openInterestValue;
          break;
        default:
          break;
      }
      return sortDirection === 'asc' ? compareResult : -compareResult;
    },
    [selectorConfig?.direction, selectorConfig?.field],
  );

  const mockedListData = useMemo(() => {
    const assetsByDexTyped: IPerpsUniverse[][] = assetsByDex || [];
    // Use frozen snapshot to prevent FlashList recycling issues from real-time WS updates
    const assetCtxsByDexTyped: IPerpsAssetCtx[][] =
      ctxSnapshotRef.current || [];

    const combinedEntries = assetsByDexTyped.flatMap(
      (assets: IPerpsUniverse[], dexIndex: number) => {
        const ctxs = assetCtxsByDexTyped[dexIndex] || [];
        return assets.map((asset, index) => {
          const normalizedAssetId =
            dexIndex === 1
              ? asset.assetId - XYZ_ASSET_ID_OFFSET
              : asset.assetId;
          const sortValues = computeSortValues(ctxs?.[normalizedAssetId]);
          return {
            dexIndex,
            index,
            assetId: asset.assetId,
            asset,
            sortValues,
          };
        });
      },
    );

    const sortField = selectorConfig?.field ?? '';
    let result: { dexIndex: number; index: number; assetId: number }[];
    if (!sortField) {
      result = combinedEntries.map((entry) => ({
        dexIndex: entry.dexIndex,
        index: entry.index,
        assetId: entry.assetId,
      }));
    } else {
      const sorted = combinedEntries.toSorted((a, b) =>
        sortCompare(
          { asset: a.asset, sortValues: a.sortValues },
          { asset: b.asset, sortValues: b.sortValues },
        ),
      );
      result = sorted.map((entry) => ({
        dexIndex: entry.dexIndex,
        index: entry.index,
        assetId: entry.assetId,
      }));
    }

    if (activeTab === 'favorites') {
      const favoriteAssetIds = new Set(
        favoriteItems.map((f: IFavoriteItem) => `${f.dexIndex}-${f.assetId}`),
      );
      return result.filter((item) =>
        favoriteAssetIds.has(`${item.dexIndex}-${item.assetId}`),
      );
    }

    // Check if activeTab is a dynamic tab
    const dynamicTab = dynamicTabs.find((t) => t.tabId === activeTab);
    if (dynamicTab) {
      const tokenSet = new Set(dynamicTab.tokens);
      const matchingIds = new Set(
        combinedEntries
          .filter((entry) => tokenSet.has(entry.asset.name))
          .map((entry) => `${entry.dexIndex}-${entry.assetId}`),
      );
      return result.filter((item) =>
        matchingIds.has(`${item.dexIndex}-${item.assetId}`),
      );
    }

    return result;
  }, [
    activeTab,
    assetsByDex,
    computeSortValues,
    dynamicTabs,
    favoriteItems,
    sortCompare,
    selectorConfig?.field,
  ]);

  // Show all server-configured dynamic tabs regardless of search results.
  // Filtering by search-filtered assetsByDex would hide tabs during search.
  const visibleDynamicTabs = dynamicTabs;

  usePerpActiveTabValidation({
    activeTab,
    setActiveTab,
    assetsByDex,
    dynamicTabs: dynamicTabsRaw,
    visibleDynamicTabs,
  });

  const keyExtractor = useCallback(
    (item: { dexIndex: number; assetId?: number; index: number }) => {
      const assetId = item.assetId ?? item.index;
      return `${item.dexIndex}-${assetId}`;
    },
    [],
  );

  const renderItem = useCallback(
    ({ item: mockedToken }: { item: ITokenSelectorListItem }) => (
      <PerpTokenSelectorRow
        isOnModal
        mockedToken={mockedToken}
        onPress={handleSelectToken}
        skipMarkRequired
      />
    ),
    [handleSelectToken],
  );

  const handleSortPress = useCallback(
    (field: IPerpTokenSortField) => {
      setSelectorConfig((prev: IPerpTokenSelectorConfig | null) => {
        if (prev?.field === field) {
          if (prev.direction === 'asc') {
            return {
              field: DEFAULT_PERP_TOKEN_SORT_FIELD,
              direction: DEFAULT_PERP_TOKEN_SORT_DIRECTION,
              activeTab: prev.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB,
            };
          }
          return {
            field,
            direction: 'asc',
            activeTab: prev.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB,
          };
        }
        return {
          field,
          direction: DEFAULT_PERP_TOKEN_SORT_DIRECTION,
          activeTab: prev?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB,
        };
      });
    },
    [setSelectorConfig],
  );
  let iconName: string;
  if (
    selectorConfig?.field === 'volume24h' &&
    selectorConfig?.direction === 'asc'
  ) {
    iconName = 'ChevronTopOutline';
  } else if (selectorConfig?.field === 'volume24h') {
    iconName = 'ChevronBottomOutline';
  } else {
    iconName = 'ChevronGrabberVerOutline';
  }
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.perps_search_perps })}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.global_search,
          }),
          onChangeText: ({ nativeEvent }) => {
            const afterTrim = nativeEvent.text.trim();
            setSearchQuery(afterTrim);
          },
          searchBarInputValue: undefined, // keep value undefined to make SearchBar Input debounce works
        }}
      />
      <Stack
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        flexShrink={0}
      >
        <ScrollableFilterBar
          selectedItemId={activeTab}
          itemGap="$2"
          itemPr="$3"
          contentContainerStyle={{ px: '$4', pb: '$2.5' }}
        >
          {(['favorites', 'all'] as const).map((tabKey) => (
            <TabItem
              key={tabKey}
              id={tabKey}
              name={tabLabels[tabKey]}
              isFocused={activeTab === tabKey}
              onPress={setActiveTab}
            />
          ))}
          {visibleDynamicTabs.map((tab) => (
            <TabItem
              key={tab.tabId}
              id={tab.tabId}
              name={tab.name}
              isFocused={activeTab === tab.tabId}
              onPress={setActiveTab}
            />
          ))}
        </ScrollableFilterBar>
      </Stack>
      <XStack
        px="$5"
        pb="$3"
        pt="$3"
        justifyContent="space-between"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => handleSortPress('volume24h')}
          userSelect="none"
          cursor="default"
        >
          <SizableText
            size="$bodySm"
            color={
              selectorConfig?.field === 'volume24h' ? '$text' : '$textSubdued'
            }
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_asset,
            })}{' '}
            /{' '}
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_volume,
            })}
          </SizableText>
          <Icon name={iconName as any} size="$3" color="$icon" />
        </XStack>
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => handleSortPress('change24hPercent')}
          userSelect="none"
          cursor="default"
        >
          <SizableText
            size="$bodySm"
            color={
              selectorConfig?.field === 'change24hPercent'
                ? '$text'
                : '$textSubdued'
            }
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_last_price,
            })}{' '}
            /{' '}
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_24h_change,
            })}
          </SizableText>
          {selectorConfig?.field === 'change24hPercent' ? (
            <Icon
              name={
                selectorConfig.direction === 'asc'
                  ? 'ChevronTopOutline'
                  : 'ChevronBottomOutline'
              }
              size="$3"
              color="$icon"
            />
          ) : null}
        </XStack>
      </XStack>
      <Page.Body>
        <YStack flex={1} mt="$2">
          <ListView
            key={`${activeTab}-${selectorConfig?.field ?? ''}-${selectorConfig?.direction ?? ''}`}
            useFlashList
            ref={listRef}
            keyExtractor={keyExtractor}
            estimatedItemSize={44}
            windowSize={3}
            initialNumToRender={15}
            decelerationRate="normal"
            showsVerticalScrollIndicator
            contentContainerStyle={{
              paddingBottom: 10,
            }}
            data={mockedListData}
            renderItem={renderItem}
            ListEmptyComponent={
              activeTab === 'favorites' && !searchQuery && isFavoritesReady ? (
                <FavoritesEmptyState isMobile />
              ) : (
                <XStack p="$5" justifyContent="center">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {searchQuery
                      ? intl.formatMessage({
                          id: ETranslations.perp_token_selector_empty,
                        })
                      : intl.formatMessage({
                          id: ETranslations.dexmarket_details_nodata,
                        })}
                  </SizableText>
                </XStack>
              )
            }
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

function MobileTokenSelectorWithProvider() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <MobileTokenSelectorModal onLoadingChange={() => {}} />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}

export default memo(MobileTokenSelectorWithProvider);
