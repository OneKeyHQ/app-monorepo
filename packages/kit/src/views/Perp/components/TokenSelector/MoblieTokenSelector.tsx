import {
  type ReactNode,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  type IListViewRef,
  Icon,
  ListView,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  usePageMounted,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  ScrollableFilterBar,
  useScrollableFilterBar,
} from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
  usePerpsTokenSearchAliasesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpTokenSelectorConfigPersistAtom,
  usePerpTokenSelectorTabsAtom,
  useSpotAssetCtxsMapAtom,
  useSpotExternalMarketCapsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  SPOT_SELECTOR_MIN_VOLUME,
  compareSpotMarketCapValues,
  formatSpotPairDisplayName,
  getSpotMarketCapValue,
  getSpotTokenDisplayName,
  getTokenSubtitle,
  isSpotInstrument,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpTokenSelectorConfig,
  IPerpTokenSortField,
  IPerpsAssetCtx,
  IPerpsUniverse,
  ISpotUniverse,
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
import {
  markTokenSelectorPerfMeasure,
  startTokenSelectorPerfMeasure,
} from '../../utils/tokenSelectorPerf';
import {
  buildPerpTokenSelectorTabs,
  getPerpTokenSelectorFallbackTabId,
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorSpotTab,
  sortPerpTokenSelectorItemsBySortValue,
} from '../../utils/tokenSelectorTabs';

import { FavoritesEmptyState } from './FavoritesEmptyState';
import {
  type ITokenSelectorListItem,
  SPOT_DEX_INDEX,
} from './PerpTokenSelector';
import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';

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

  // Spot data — try cache first, fallback to refresh if empty
  const [spotPriceMap] = useSpotAssetCtxsMapAtom();
  const [spotUniverses, setSpotUniverses] = useState<ISpotUniverse[]>([]);
  const [spotLoading, setSpotLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let { universes } =
        await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
      if (!universes?.length) {
        await backgroundApiProxy.serviceHyperliquid.refreshSpotMeta();
        const res = await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
        universes = res.universes;
      }
      if (!cancelled) {
        setSpotUniverses(universes ?? []);
        setSpotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectToken = useCallback(
    async (symbol: string) => {
      const isSpotToken = isSpotInstrument(symbol);
      try {
        onLoadingChange(true);
        navigation.popStack();
        if (isSpotToken) {
          const universe = spotUniverses.find((u) => u.name === symbol);
          // universe may be undefined if spotMeta hasn't loaded yet;
          // switchTradeInstrument has a built-in fallback that fetches spotMeta.
          await actions.current.switchTradeInstrument({
            mode: 'spot',
            coin: symbol,
            spotUniverse: universe,
          });
        } else {
          await actions.current.switchTradeInstrument({
            mode: 'perp',
            coin: symbol,
          });
        }
      } catch (error) {
        console.error('Failed to switch token:', error);
      } finally {
        onLoadingChange(false);
      }
    },
    [onLoadingChange, navigation, actions, spotUniverses],
  );

  const [{ assetsByDex }] = usePerpsAllAssetsFilteredAtom();
  const [{ assetCtxsByDex }] = usePerpsAllAssetCtxsAtom();
  const [tokenSearchAliases] = usePerpsTokenSearchAliasesAtom();
  const { favoriteItems, isReady: isFavoritesReady } = usePerpsFavorites();
  const [selectorConfig, setSelectorConfig] =
    usePerpTokenSelectorConfigPersistAtom();
  const [dynamicTabsRaw] = usePerpTokenSelectorTabsAtom();
  const [spotMarketCaps] = useSpotExternalMarketCapsAtom();
  const dynamicTabs = useMemo(() => dynamicTabsRaw ?? [], [dynamicTabsRaw]);
  const activeTab = selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const listRef = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);
  const fixedTabNames = useMemo(
    () => ({
      favorites: intl.formatMessage({ id: ETranslations.perp_tab_favs }),
      all: intl.formatMessage({ id: ETranslations.global_all }),
      perps: intl.formatMessage({
        id: ETranslations.perps_token_selector_perps,
      }),
      spot: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
    }),
    [intl],
  );
  const visibleTabs = useMemo(
    () =>
      buildPerpTokenSelectorTabs({
        serverTabs: dynamicTabs,
        fixedTabNames,
      }),
    [dynamicTabs, fixedTabNames],
  );
  const displayActiveTab = useMemo(() => {
    if (visibleTabs.some((tab) => tab.tabId === activeTab)) {
      return activeTab;
    }
    return getPerpTokenSelectorFallbackTabId(visibleTabs);
  }, [activeTab, visibleTabs]);
  const scrollListToTop = useCallback(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, []);

  useEffect(() => {
    const currentActions = actions.current;
    currentActions.setTradeRouteViewState({
      tokenSelectorOpen: true,
    });
    return () => {
      currentActions.setTradeRouteViewState({
        tokenSelectorOpen: false,
      });
    };
  }, [actions]);

  useEffect(() => {
    actions.current.setTradeRouteViewState({
      tokenSelectorTab: displayActiveTab,
    });
  }, [actions, displayActiveTab]);

  // Mount FlashList only after the navigation transition animation completes.
  // transitionEnd fires via navigation listener, so this is exact — no guesswork.
  const [isListReady, setIsListReady] = useState(false);
  usePageMounted(() => setIsListReady(true));

  // Freeze sort order; only refresh on sort config change or first data arrival.
  // Does NOT track activeTab — tab switches should not refresh the snapshot.
  const ctxSnapshotRef = useRef(assetCtxsByDex);
  const lastSortRef = useRef<{
    field?: string;
    direction?: string;
  } | null>(null);
  useEffect(() => {
    const field = selectorConfig?.field;
    const direction = selectorConfig?.direction;
    const last = lastSortRef.current;
    const sortChanged = last?.field !== field || last?.direction !== direction;
    // Also refresh when snapshot is empty (first WS data arrival after mount)
    const snapshotEmpty = !ctxSnapshotRef.current?.some(
      (arr) => arr?.length > 0,
    );
    if (!sortChanged && !snapshotEmpty) {
      return;
    }
    lastSortRef.current = { field, direction };
    ctxSnapshotRef.current = assetCtxsByDex;
    if (sortChanged) {
      scrollListToTop();
    }
  }, [
    selectorConfig?.direction,
    selectorConfig?.field,
    assetCtxsByDex,
    scrollListToTop,
  ]);

  // Container-level mark instead of per-row
  useEffect(() => {
    actions.current.markAllAssetCtxsRequired();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      actions.current.markAllAssetCtxsNotRequired();
    };
  }, [actions]);

  const setActiveTab = useCallback(
    (tab: string) => {
      if (tab === activeTab) {
        return;
      }
      startTransition(() => {
        setSelectorConfig((prev) => ({
          field: prev?.field ?? DEFAULT_PERP_TOKEN_SORT_FIELD,
          direction: prev?.direction ?? DEFAULT_PERP_TOKEN_SORT_DIRECTION,
          activeTab: tab,
        }));
      });
    },
    [activeTab, setSelectorConfig],
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
        case 'marketCap':
          compareResult = 0;
          break;
        default:
          break;
      }
      return sortDirection === 'asc' ? compareResult : -compareResult;
    },
    [selectorConfig?.direction, selectorConfig?.field],
  );

  // Layer 1: sort — only reruns when sort config or underlying assets change.
  // Does NOT depend on activeTab, so tab switches never retrigger the sort.
  const perpSortedList = useMemo(() => {
    const perfStartTime = startTokenSelectorPerfMeasure();
    const assetsByDexTyped: IPerpsUniverse[][] = assetsByDex || [];
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
          return { dexIndex, index, assetId: asset.assetId, asset, sortValues };
        });
      },
    );

    const mapEntry = (
      entry: (typeof combinedEntries)[0],
    ): ITokenSelectorListItem => ({
      dexIndex: entry.dexIndex,
      index: entry.index,
      assetId: entry.assetId,
      tokenName: entry.asset.name,
      tokenMaxLeverage: entry.asset.maxLeverage,
      tokenSubtitle: getTokenSubtitle(entry.asset.name, tokenSearchAliases),
    });

    const sortField = selectorConfig?.field ?? '';
    const sortDirection = selectorConfig?.direction ?? 'desc';
    const result = sortField
      ? combinedEntries
          .toSorted((a, b) =>
            sortCompare(
              { asset: a.asset, sortValues: a.sortValues },
              { asset: b.asset, sortValues: b.sortValues },
            ),
          )
          .map(mapEntry)
      : combinedEntries.map(mapEntry);

    if (perfStartTime !== undefined) {
      markTokenSelectorPerfMeasure(perfStartTime, {
        layout: 'mobile',
        phase: 'perp-sort',
        sortField,
        sortDirection,
        perpCount: combinedEntries.length,
        resultCount: result.length,
      });
    }

    return result;
  }, [
    assetsByDex,
    computeSortValues,
    sortCompare,
    selectorConfig?.direction,
    selectorConfig?.field,
    tokenSearchAliases,
  ]);

  // Layer 1b: spot sort — isolated from perp. Reruns only when spot data or
  // sort config changes. spotPriceMap WS updates never touch the perp list.
  const spotSortedList = useMemo((): ITokenSelectorListItem[] => {
    const perfStartTime = startTokenSelectorPerfMeasure();
    const sortField = selectorConfig?.field ?? '';
    const sortDirection = selectorConfig?.direction ?? 'desc';

    const mappedEntries = spotUniverses.map((u, index) => {
      const ctx = spotPriceMap[u.name];
      const markPrice = Number(ctx?.markPx || 0);
      const prevDayPx = Number(ctx?.prevDayPx || 0);
      const change24hPercent =
        prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;
      const volume24h = Number(ctx?.dayNtlVlm || 0);
      const marketCapValue = getSpotMarketCapValue(
        ctx,
        u.baseName,
        spotMarketCaps,
      );
      const marketCap = marketCapValue ? Number(marketCapValue) : undefined;
      return {
        item: {
          dexIndex: SPOT_DEX_INDEX,
          index,
          assetId: u.assetId,
          tokenSubtitle:
            getTokenSubtitle(
              getSpotTokenDisplayName(u.baseName),
              tokenSearchAliases,
            ) ?? getTokenSubtitle(u.baseName, tokenSearchAliases),
          spotUniverse: u,
        } as ITokenSelectorListItem,
        name: u.baseName,
        markPrice,
        change24hPercent,
        volume24h,
        marketCap,
      };
    });
    const hasVolumeData = mappedEntries.some((e) => e.volume24h > 0);
    const entries = mappedEntries.filter(
      (e) => !hasVolumeData || e.volume24h >= SPOT_SELECTOR_MIN_VOLUME,
    );

    if (sortField) {
      entries.sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'name':
            cmp = a.name.localeCompare(b.name, undefined, {
              sensitivity: 'base',
            });
            break;
          case 'markPrice':
            cmp = a.markPrice - b.markPrice;
            break;
          case 'change24hPercent':
            cmp = a.change24hPercent - b.change24hPercent;
            break;
          case 'volume24h':
            cmp = a.volume24h - b.volume24h;
            break;
          case 'marketCap':
          case 'openInterest':
            return compareSpotMarketCapValues(
              a.marketCap,
              b.marketCap,
              sortDirection,
            );
          default:
            break;
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    const result = entries.map((e) => e.item);
    if (perfStartTime !== undefined) {
      markTokenSelectorPerfMeasure(perfStartTime, {
        layout: 'mobile',
        phase: 'spot-sort',
        sortField,
        sortDirection,
        spotCount: spotUniverses.length,
        resultCount: result.length,
        volumeFilteredCount: spotUniverses.length - result.length,
      });
    }

    return result;
  }, [
    spotUniverses,
    spotPriceMap,
    spotMarketCaps,
    tokenSearchAliases,
    selectorConfig?.field,
    selectorConfig?.direction,
  ]);

  // Layer 2: filter — cheap O(n) filter; never runs sort.
  // Tab switches and favorites changes only reach here, not the sort layer.
  const mockedListData = useMemo(() => {
    const perfStartTime = startTokenSelectorPerfMeasure();
    const sortField = selectorConfig?.field ?? '';
    const sortDirection = selectorConfig?.direction ?? 'desc';

    const getPerpSortValue = (
      item: ITokenSelectorListItem,
    ): string | number | undefined => {
      if (!sortField) {
        return undefined;
      }
      const assetId = item.assetId ?? item.index;
      const normalizedAssetId =
        item.dexIndex === 1 ? assetId - XYZ_ASSET_ID_OFFSET : assetId;
      const ctx = ctxSnapshotRef.current?.[item.dexIndex]?.[normalizedAssetId];
      const markPrice = Number(ctx?.markPx || 0);
      const prevDayPx = Number(ctx?.prevDayPx || 0);
      switch (sortField) {
        case 'name':
          return item.tokenName ?? '';
        case 'markPrice':
          return markPrice;
        case 'change24hPercent':
          return prevDayPx > 0
            ? ((markPrice - prevDayPx) / prevDayPx) * 100
            : 0;
        case 'fundingRate':
          return Number(ctx?.funding || 0);
        case 'volume24h':
          return Number(ctx?.dayNtlVlm || 0);
        case 'openInterest':
          return Number(ctx?.openInterest || 0) * markPrice;
        case 'marketCap':
          return undefined;
        default:
          return undefined;
      }
    };

    const getSpotSortValue = (
      item: ITokenSelectorListItem,
    ): string | number | undefined => {
      const universe = item.spotUniverse;
      if (!sortField || !universe) {
        return undefined;
      }
      const ctx = spotPriceMap[universe.name];
      const markPrice = Number(ctx?.markPx || 0);
      const prevDayPx = Number(ctx?.prevDayPx || 0);
      switch (sortField) {
        case 'name':
          return universe.baseName;
        case 'markPrice':
          return markPrice;
        case 'change24hPercent':
          return prevDayPx > 0
            ? ((markPrice - prevDayPx) / prevDayPx) * 100
            : 0;
        case 'volume24h':
          return Number(ctx?.dayNtlVlm || 0);
        case 'marketCap': {
          const marketCapValue = getSpotMarketCapValue(
            ctx,
            universe.baseName,
            spotMarketCaps,
          );
          return marketCapValue ? Number(marketCapValue) : undefined;
        }
        case 'fundingRate':
        case 'openInterest':
          return undefined;
        default:
          return undefined;
      }
    };

    const sortMixedList = (items: ITokenSelectorListItem[]) => {
      if (!sortField) {
        return items;
      }
      return sortPerpTokenSelectorItemsBySortValue({
        items,
        direction: sortDirection,
        getValue: (item) =>
          item.spotUniverse ? getSpotSortValue(item) : getPerpSortValue(item),
      });
    };

    const getSpotListBySearch = () => {
      if (!searchQuery) return spotSortedList;
      const q = searchQuery.toLowerCase();
      return spotSortedList.filter((item) => {
        const u = item.spotUniverse;
        if (!u) return false;
        const displayBase = getSpotTokenDisplayName(u.baseName);
        const pairDisplay = formatSpotPairDisplayName(u.baseName, u.quoteName);
        return (
          u.baseName.toLowerCase().includes(q) ||
          displayBase.toLowerCase().includes(q) ||
          pairDisplay.toLowerCase().includes(q)
        );
      });
    };

    let result: ITokenSelectorListItem[];

    if (isPerpTokenSelectorSpotTab(displayActiveTab)) {
      result = getSpotListBySearch();
    } else if (isPerpTokenSelectorFavoritesTab(displayActiveTab)) {
      const favoriteAssetIds = new Set(
        favoriteItems.map((f: IFavoriteItem) => `${f.dexIndex}-${f.assetId}`),
      );
      result = perpSortedList.filter((item) =>
        favoriteAssetIds.has(`${item.dexIndex}-${item.assetId}`),
      );
    } else if (isPerpTokenSelectorAllTab(displayActiveTab)) {
      result = sortMixedList([...perpSortedList, ...getSpotListBySearch()]);
    } else if (isPerpTokenSelectorPerpsTab(displayActiveTab)) {
      result = perpSortedList;
    } else {
      const dynamicTab = visibleTabs.find((t) => t.tabId === displayActiveTab);
      if (dynamicTab) {
        const tokenSet = new Set(dynamicTab.tokens);
        const matchingIds = new Set<string>();
        (assetsByDex || []).forEach((assets, dexIndex) => {
          assets?.forEach((asset) => {
            if (tokenSet.has(asset.name)) {
              matchingIds.add(`${dexIndex}-${asset.assetId}`);
            }
          });
        });
        result = perpSortedList.filter((item) =>
          matchingIds.has(`${item.dexIndex}-${item.assetId}`),
        );
      } else {
        result = perpSortedList;
      }
    }

    if (perfStartTime !== undefined) {
      markTokenSelectorPerfMeasure(perfStartTime, {
        layout: 'mobile',
        phase: 'active-tab',
        activeTab: displayActiveTab,
        sortField,
        sortDirection,
        perpCount: perpSortedList.length,
        spotCount: spotSortedList.length,
        resultCount: result.length,
        searchQueryLength: searchQuery.length,
        dynamicTabCount: visibleTabs.length,
      });
    }

    return result;
  }, [
    displayActiveTab,
    assetsByDex,
    favoriteItems,
    perpSortedList,
    selectorConfig?.direction,
    selectorConfig?.field,
    spotSortedList,
    spotPriceMap,
    spotMarketCaps,
    searchQuery,
    visibleTabs,
  ]);

  usePerpActiveTabValidation({
    activeTab,
    setActiveTab,
    assetsByDex,
    dynamicTabs: dynamicTabsRaw,
    visibleTabs,
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

  let listEmptyComponent: ReactNode;
  if (isPerpTokenSelectorSpotTab(displayActiveTab) && spotLoading) {
    listEmptyComponent = (
      <YStack p="$5" alignItems="center">
        <Spinner size="small" />
      </YStack>
    );
  } else if (
    isPerpTokenSelectorFavoritesTab(displayActiveTab) &&
    !searchQuery &&
    isFavoritesReady
  ) {
    listEmptyComponent = <FavoritesEmptyState isMobile />;
  } else {
    listEmptyComponent = (
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
    );
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_search_asset })}
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
          selectedItemId={displayActiveTab}
          itemGap="$2"
          itemPr="$3"
          contentContainerStyle={{ px: '$4', pb: '$2.5' }}
        >
          {visibleTabs.map((tab) => (
            <TabItem
              key={tab.tabId}
              id={tab.tabId}
              name={tab.name}
              isFocused={displayActiveTab === tab.tabId}
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
          {isListReady ? (
            <ListView
              useFlashList
              key={activeTab}
              ref={listRef}
              keyExtractor={keyExtractor}
              estimatedItemSize={44}
              windowSize={3}
              initialNumToRender={5}
              decelerationRate="normal"
              showsVerticalScrollIndicator
              nestedScrollEnabled={platformEnv.isNativeAndroid}
              contentContainerStyle={{
                paddingBottom: 10,
              }}
              data={mockedListData}
              renderItem={renderItem}
              ListEmptyComponent={listEmptyComponent}
            />
          ) : null}
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
