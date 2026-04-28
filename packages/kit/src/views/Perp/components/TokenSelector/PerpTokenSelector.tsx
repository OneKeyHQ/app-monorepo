/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import {
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
  Badge,
  DebugRenderTracker,
  type IListViewRef,
  Icon,
  ListView,
  NATIVE_HIT_SLOP,
  NumberSizeableText,
  Popover,
  SearchBar,
  SizableText,
  Spinner,
  Tooltip,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
  usePerpsTokenSearchAliasesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import {
  usePerpTokenSelectorConfigPersistAtom,
  usePerpTokenSelectorTabsAtom,
  usePerpsActiveAssetCtxAtom,
  useSpotAssetCtxsMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSpotActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import {
  SPOT_MIN_VOLUME_STRICT,
  formatSpotPairDisplayName,
  getHyperliquidTokenImageUrl,
  getSpotTokenDisplayName,
  getTokenSubtitle,
  isSpotInstrument,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
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
import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';

import { FavoritesEmptyState } from './FavoritesEmptyState';
import {
  PerpTokenSelectorRow,
  SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT,
  TradingModeBadge,
} from './PerpTokenSelectorRow';
import { SortableHeaderCell } from './SortableHeaderCell';

export const SPOT_DEX_INDEX = -1;

export type ITokenSelectorListItem = {
  dexIndex: number;
  index: number;
  assetId?: number;
  // Perp-specific: pre-computed static token data so rows don't subscribe to universe atom
  tokenName?: string;
  tokenMaxLeverage?: number;
  tokenSubtitle?: string;
  // Spot-specific: carries display name for rendering since spot uses @N identifiers
  spotUniverse?: ISpotUniverse;
};

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
    const handlePress = useCallback(() => onPress(id), [id, onPress]);
    return (
      <XStack
        py="$3"
        ml="$4"
        mr="$2"
        borderBottomWidth={isFocused ? '$0.5' : '$0'}
        borderBottomColor="$borderActive"
        onPress={handlePress}
        cursor="default"
      >
        <SizableText
          size="$headingXs"
          color={isFocused ? '$text' : '$textSubdued'}
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);
TabItem.displayName = 'TabItem';

function TokenListHeader({ isSpot }: { isSpot?: boolean }) {
  const intl = useIntl();
  return (
    <XStack
      px="$4"
      py="$3"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      <SortableHeaderCell
        field="name"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        })}
        width={isSpot ? undefined : 180}
        flex={
          isSpot
            ? SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.asset.flex
            : undefined
        }
        minWidth={
          isSpot
            ? SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.asset.minWidth
            : 180
        }
      />
      <SortableHeaderCell
        field="markPrice"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_last_price,
        })}
        width={isSpot ? undefined : 110}
        flex={
          isSpot
            ? SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.price.flex
            : undefined
        }
        minWidth={
          isSpot
            ? SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.price.minWidth
            : 110
        }
      />
      <SortableHeaderCell
        field="change24hPercent"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_24h_change,
        })}
        width={isSpot ? undefined : 150}
        flex={
          isSpot
            ? SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.change24h.flex
            : undefined
        }
        minWidth={
          isSpot
            ? SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.change24h.minWidth
            : 150
        }
      />
      {isSpot ? null : (
        <>
          <SortableHeaderCell
            field="fundingRate"
            label={intl.formatMessage({
              id: ETranslations.perp_position_funding,
            })}
            width={110}
          />
          <SortableHeaderCell
            field="volume24h"
            label={intl.formatMessage({
              id: ETranslations.perp_token_selector_volume,
            })}
            width={110}
          />
          <SortableHeaderCell
            field="openInterest"
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_open_Interest,
            })}
            width={120}
          />
        </>
      )}
      {isSpot ? (
        <>
          <SortableHeaderCell
            field="volume24h"
            label={intl.formatMessage({
              id: ETranslations.perp_token_selector_volume,
            })}
            flex={SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.volume.flex}
            minWidth={SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.volume.minWidth}
          />
          <SortableHeaderCell
            field="openInterest"
            label={intl.formatMessage({
              id: ETranslations.global_market_cap,
            })}
            flex={SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.marketCap.flex}
            minWidth={
              SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.marketCap.minWidth
            }
          />
        </>
      ) : null}
    </XStack>
  );
}

function BasePerpTokenSelectorContent({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { searchQuery, setSearchQuery, refreshAllAssets } =
    usePerpTokenSelector();
  const { closePopover } = usePopoverContext();
  const actions = useHyperliquidActions();

  const [{ assetsByDex }] = usePerpsAllAssetsFilteredAtom();
  const [{ assetCtxsByDex }] = usePerpsAllAssetCtxsAtom();
  const [tokenSearchAliases] = usePerpsTokenSearchAliasesAtom();
  const [selectorConfig, setSelectorConfig] =
    usePerpTokenSelectorConfigPersistAtom();
  const [dynamicTabsRaw] = usePerpTokenSelectorTabsAtom();
  const dynamicTabs: IPerpDynamicTab[] = useMemo(
    () => dynamicTabsRaw ?? [],
    [dynamicTabsRaw],
  );

  const tabNames = useMemo(
    () => ({
      favorites: intl.formatMessage({ id: ETranslations.perp_tab_favs }),
      all: intl.formatMessage({ id: ETranslations.perps_token_selector_perps }),
      spot: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
    }),
    [intl],
  );

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
  const activeTab = selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const listRef = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);

  const setActiveTab = useCallback(
    (tab: string) => {
      startTransition(() => {
        setSelectorConfig(
          (prev) =>
            ({
              field: prev?.field ?? DEFAULT_PERP_TOKEN_SORT_FIELD,
              direction: prev?.direction ?? DEFAULT_PERP_TOKEN_SORT_DIRECTION,
              activeTab: tab,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any,
        );
      });
      actions.current.setTradeRouteViewState({
        tokenSelectorTab: tab,
      });
    },
    [actions, setSelectorConfig],
  );

  const handleSelectToken = useCallback(
    async (symbol: string) => {
      const isSpotToken = isSpotInstrument(symbol);
      try {
        onLoadingChange(true);
        if (isSpotToken) {
          const universe = spotUniverses.find((u) => u.name === symbol);
          if (!universe) {
            return;
          }
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
        void closePopover?.();
      } catch (error) {
        console.error('Failed to switch token:', error);
      } finally {
        onLoadingChange(false);
      }
    },
    [closePopover, actions, onLoadingChange, spotUniverses],
  );

  const { favoriteItems, isReady: isFavoritesReady } = usePerpsFavorites();

  // Freeze sort order while popover is open; refreshed on sort change or first data arrival.
  const ctxSnapshotRef = useRef(assetCtxsByDex);
  const lastSortRef = useRef<{ field?: string; direction?: string } | null>(
    null,
  );
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
      listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    }
  }, [selectorConfig?.direction, selectorConfig?.field, assetCtxsByDex]);

  // Container-level mark instead of per-row
  useEffect(() => {
    actions.current.markAllAssetCtxsRequired();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      actions.current.markAllAssetCtxsNotRequired();
    };
  }, [actions]);

  useEffect(() => {
    actions.current.setTradeRouteViewState({
      tokenSelectorTab: activeTab,
    });
  }, [actions, activeTab]);

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

  // Layer 1a: perp sort — only reruns when sort config or perp assets change.
  // Never reruns on tab switch, spot WS updates, search, or favorites changes.
  const perpSortedList = useMemo((): ITokenSelectorListItem[] => {
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
          return { dexIndex, index, asset, assetId: asset.assetId, sortValues };
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
    if (!sortField) {
      return combinedEntries.map(mapEntry);
    }
    return combinedEntries
      .toSorted((a, b) =>
        sortCompare(
          { asset: a.asset, sortValues: a.sortValues },
          { asset: b.asset, sortValues: b.sortValues },
        ),
      )
      .map(mapEntry);
  }, [
    assetsByDex,
    computeSortValues,
    sortCompare,
    selectorConfig?.field,
    tokenSearchAliases,
  ]);

  // Layer 1b: spot sort — isolated from perp. Reruns only when spot data or
  // sort config changes. spotPriceMap WS updates never touch the perp list.
  const spotSortedList = useMemo((): ITokenSelectorListItem[] => {
    const sortField = selectorConfig?.field ?? '';
    const sortDirection = selectorConfig?.direction ?? 'desc';

    const entries = spotUniverses
      .map((u, index) => {
        const ctx = spotPriceMap[u.name];
        const markPrice = Number(ctx?.markPx || 0);
        const prevDayPx = Number(ctx?.prevDayPx || 0);
        const change24hPercent =
          prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;
        const volume24h = Number(ctx?.dayNtlVlm || 0);
        const circulatingSupply = Number(ctx?.circulatingSupply || 0);
        const marketCap = circulatingSupply * markPrice;
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
      })
      .filter((e) => e.volume24h >= SPOT_MIN_VOLUME_STRICT);

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
          case 'openInterest':
            // Reuse openInterest field for marketCap sort in spot tab
            cmp = a.marketCap - b.marketCap;
            break;
          default:
            break;
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return entries.map((e) => e.item);
  }, [
    spotUniverses,
    spotPriceMap,
    tokenSearchAliases,
    selectorConfig?.field,
    selectorConfig?.direction,
  ]);

  // Layer 2: filter — cheap O(n); no sort computation.
  // Tab switches, search, and favorites changes only reach here.
  // perpSortedList reference is stable unless sort config changes, so ListView
  // bails out of re-rendering rows when spot WS updates trigger a component render.
  const activeTabData = useMemo(() => {
    if (activeTab === 'spot') {
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
    }

    if (activeTab === 'favorites') {
      const favoriteAssetIds = new Set(
        favoriteItems.map((f: IFavoriteItem) => `${f.dexIndex}-${f.assetId}`),
      );
      return perpSortedList.filter((item) =>
        favoriteAssetIds.has(`${item.dexIndex}-${item.assetId}`),
      );
    }

    const dynamicTab = dynamicTabs.find((t) => t.tabId === activeTab);
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
      return perpSortedList.filter((item) =>
        matchingIds.has(`${item.dexIndex}-${item.assetId}`),
      );
    }

    return perpSortedList;
  }, [
    activeTab,
    assetsByDex,
    dynamicTabs,
    favoriteItems,
    perpSortedList,
    spotSortedList,
    searchQuery,
  ]);

  // Always show all dynamic tabs — filtering them by search would hide tabs mid-search.
  const visibleDynamicTabs = dynamicTabs;

  usePerpActiveTabValidation({
    activeTab,
    setActiveTab,
    assetsByDex,
    dynamicTabs: dynamicTabsRaw,
    visibleDynamicTabs,
  });

  const keyExtractor = useCallback(
    (item: { dexIndex: number; index: number; assetId?: number }) => {
      const assetId = item.assetId ?? item.index;
      return `${item.dexIndex}-${assetId}`;
    },
    [],
  );

  const renderItem = useCallback(
    ({ item: mockedToken }: { item: ITokenSelectorListItem }) => (
      <PerpTokenSelectorRow
        mockedToken={mockedToken}
        onPress={handleSelectToken}
        skipMarkRequired
      />
    ),
    [handleSelectToken],
  );

  const showFavoritesEmpty =
    activeTab === 'favorites' &&
    activeTabData.length === 0 &&
    !searchQuery &&
    isFavoritesReady;

  const listEmptyComponent = useMemo(() => {
    if (activeTab === 'spot' && spotLoading) {
      return (
        <YStack p="$4" alignItems="center">
          <Spinner size="small" />
        </YStack>
      );
    }
    if (showFavoritesEmpty) {
      return <FavoritesEmptyState />;
    }
    return (
      <XStack p="$4" justifyContent="center">
        <SizableText size="$bodySm" color="$textSubdued">
          {searchQuery
            ? intl.formatMessage({
                id: ETranslations.perp_token_selector_empty,
              })
            : intl.formatMessage({
                id: ETranslations.perp_token_selector_loading,
              })}
        </SizableText>
      </XStack>
    );
  }, [activeTab, spotLoading, showFavoritesEmpty, searchQuery, intl]);

  const content = (
    <YStack>
      <YStack gap="$1">
        <XStack px="$2" pt="$2">
          <SearchBar
            containerProps={{
              borderRadius: '$2',
              mx: '$2',
              mt: '$2',
              flex: 1,
            }}
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            onChangeText={setSearchQuery}
            // value={searchQuery} // keep value undefined to make debounce works
          />
        </XStack>
        <XStack
          borderBottomWidth="$px"
          borderBottomColor="$borderSubdued"
          bg="$bg"
          px="$0"
        >
          <TabItem
            id="favorites"
            name={tabNames.favorites}
            isFocused={activeTab === 'favorites'}
            onPress={setActiveTab}
          />
          <TabItem
            id="all"
            name={tabNames.all}
            isFocused={activeTab === 'all'}
            onPress={setActiveTab}
          />
          <TabItem
            id="spot"
            name={tabNames.spot}
            isFocused={activeTab === 'spot'}
            onPress={setActiveTab}
          />
          {visibleDynamicTabs.map((tab: IPerpDynamicTab) => (
            <TabItem
              key={tab.tabId}
              id={tab.tabId}
              name={tab.name}
              isFocused={activeTab === tab.tabId}
              onPress={setActiveTab}
            />
          ))}
        </XStack>
        <YStack>
          {!showFavoritesEmpty ? (
            <TokenListHeader isSpot={activeTab === 'spot'} />
          ) : null}
          <YStack height={350}>
            {showFavoritesEmpty ? (
              <FavoritesEmptyState />
            ) : (
              <ListView
                ref={listRef}
                keyExtractor={keyExtractor}
                windowSize={3}
                initialNumToRender={12}
                data={activeTabData}
                renderItem={renderItem}
                ListEmptyComponent={listEmptyComponent}
                contentContainerStyle={{
                  paddingBottom: 10,
                }}
              />
            )}
          </YStack>
        </YStack>
      </YStack>
    </YStack>
  );
  return (
    <DebugRenderTracker position="top-right" name="PerpTokenSelectorContent">
      {content}
    </DebugRenderTracker>
  );
}

function PerpTokenSelectorContent({
  isOpen,
  onLoadingChange,
}: {
  isOpen: boolean;
  onLoadingChange: (isLoading: boolean) => void;
}) {
  return isOpen ? (
    <BasePerpTokenSelectorContent onLoadingChange={onLoadingChange} />
  ) : null;
}

const PerpTokenSelectorContentMemo = memo(PerpTokenSelectorContent);

function BasePerpTokenSelector() {
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const [isOpen, setIsOpen] = useState(false);
  const { displayName, baseName, mode } = useActiveTradeDisplay();
  const [isLoading, setIsLoading] = useState(false);
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setBuilderFeeRate(fee);
      });
  }, []);
  useEffect(() => {
    actions.current.setTradeRouteViewState({
      tokenSelectorOpen: isOpen,
    });
  }, [actions, isOpen]);
  const triggerLabel = mode === 'spot' ? displayName : `${displayName}USDC`;
  const content = useMemo(
    () => (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.dexmarket_select_token,
        })}
        floatingPanelProps={{
          width: 800,
        }}
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
        }}
        placement="bottom-start"
        renderTrigger={
          <Badge
            gap="$3"
            bg="$bgApp"
            px="$2"
            py="$1.5"
            borderRadius="$full"
            cursor="default"
            minWidth={0}
            maxWidth={420}
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
          >
            <Token
              size="md"
              borderRadius="$full"
              tokenImageUri={getHyperliquidTokenImageUrl(baseName)}
              fallbackIcon="CryptoCoinOutline"
            />

            {/* Token Name */}
            <SizableText
              size="$heading2xl"
              numberOfLines={1}
              minWidth={0}
              flexShrink={1}
            >
              {triggerLabel}
            </SizableText>
            <TradingModeBadge isSpot={mode === 'spot'} />
            {builderFeeRate === 0 ? (
              <Tooltip
                placement="bottom"
                renderTrigger={
                  <Badge badgeType="success" badgeSize="sm">
                    {intl.formatMessage({
                      id: ETranslations.perp_0_fee,
                    })}
                  </Badge>
                }
                renderContent={
                  <SizableText size="$bodySm">
                    {intl.formatMessage({
                      id: ETranslations.perps_0_fee_desc,
                    })}
                  </SizableText>
                }
              />
            ) : null}
            <Icon name="ChevronBottomOutline" size="$4" />
            {isLoading ? <Spinner size="small" /> : null}
          </Badge>
        }
        renderContent={({ isOpen: isOpenProp }) => (
          <PerpTokenSelectorContentMemo
            isOpen={isOpenProp ?? false}
            onLoadingChange={setIsLoading}
          />
        )}
      />
    ),
    [isOpen, isLoading, triggerLabel, baseName, mode, builderFeeRate, intl],
  );
  return (
    <DebugRenderTracker name="PerpTokenSelector">{content}</DebugRenderTracker>
  );
}

export const PerpTokenSelector = memo(BasePerpTokenSelector);

const BasePerpTokenSelectorMobileView = memo(
  ({
    onPressTokenSelector,
    displayLabel,
    change24hPercent,
  }: {
    onPressTokenSelector: () => void;
    displayLabel: string;
    change24hPercent: number;
  }) => (
    <DebugRenderTracker name="BasePerpTokenSelectorMobileView">
      <XStack
        gap="$1"
        bg="$bgApp"
        justifyContent="center"
        alignItems="center"
        onPress={onPressTokenSelector}
        hitSlop={NATIVE_HIT_SLOP}
      >
        <SizableText size="$headingLg">{displayLabel}</SizableText>
        <NumberSizeableText
          style={{ fontSize: 10 }}
          fontFamily="$monoRegular"
          fontVariant={['tabular-nums']}
          alignSelf="center"
          color={change24hPercent >= 0 ? '$green11' : '$red11'}
          formatter="priceChange"
          formatterOptions={{
            showPlusMinusSigns: true,
          }}
        >
          {change24hPercent}
        </NumberSizeableText>
        <Icon name="ChevronTriangleDownSmallSolid" size="$5" />
      </XStack>
    </DebugRenderTracker>
  ),
);
BasePerpTokenSelectorMobileView.displayName = 'BasePerpTokenSelectorMobileView';
function BasePerpTokenSelectorMobile() {
  const navigation = useAppNavigation();
  const { displayName, mode } = useActiveTradeDisplay();

  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const change24hPercent =
    mode === 'spot'
      ? spotAssetCtx?.ctx?.change24hPercent || 0
      : assetCtx?.ctx?.change24hPercent || 0;

  const displayLabel = mode === 'spot' ? displayName : `${displayName}USDC`;

  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  return (
    <BasePerpTokenSelectorMobileView
      onPressTokenSelector={onPressTokenSelector}
      displayLabel={displayLabel}
      change24hPercent={change24hPercent}
    />
  );
}

export const PerpTokenSelectorMobile = memo(BasePerpTokenSelectorMobile);
