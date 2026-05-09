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
  ScrollView,
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
  type ISpotAssetCtxsMap,
  spotAssetCtxsMapAtom,
  usePerpTokenSelectorConfigPersistAtom,
  usePerpTokenSelectorTabsAtom,
  usePerpsActiveAssetCtxAtom,
  useSpotExternalMarketCapsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSpotActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import {
  SPOT_SELECTOR_MIN_VOLUME,
  compareSpotMarketCapValues,
  formatSpotPairDisplayName,
  getHyperliquidTokenImageUrl,
  getSpotMarketCapValue,
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
import {
  markTokenSelectorPerfMeasure,
  startTokenSelectorPerfMeasure,
} from '../../utils/tokenSelectorPerf';
import {
  buildPerpTokenSelectorCategoryTabs,
  buildPerpTokenSelectorTabs,
  buildPrimaryTabs,
  getPerpTokenSelectorFallbackTabId,
  getPerpTokenSelectorPrimaryTabId,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorSpotTab,
} from '../../utils/tokenSelectorTabs';

import { FavoritesEmptyState } from './FavoritesEmptyState';
import {
  MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT,
  PerpTokenSelectorRow,
  SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT,
  TradingModeBadge,
} from './PerpTokenSelectorRow';
import { SortableHeaderCell } from './SortableHeaderCell';

export const SPOT_DEX_INDEX = -1;
const DESKTOP_TOKEN_SELECTOR_PANEL_WIDTH = 800;
const TOKEN_SELECTOR_TABLE_HORIZONTAL_PADDING = 32;
const PERP_TOKEN_SELECTOR_DESKTOP_TABLE_MIN_WIDTH =
  180 + 110 + 150 + 110 + 110 + 120 + TOKEN_SELECTOR_TABLE_HORIZONTAL_PADDING;

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

const DESKTOP_TOKEN_SELECTOR_TABLE_MIN_WIDTH = {
  perp: PERP_TOKEN_SELECTOR_DESKTOP_TABLE_MIN_WIDTH,
  spot:
    SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.asset.minWidth +
    SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.price.minWidth +
    SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.change24h.minWidth +
    SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.volume.minWidth +
    SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.marketCap.minWidth +
    TOKEN_SELECTOR_TABLE_HORIZONTAL_PADDING,
  mixed:
    MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.asset.minWidth +
    MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.price.minWidth +
    MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.change24h.minWidth +
    MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.fundingRate.minWidth +
    MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.volume.minWidth +
    MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.openInterest.minWidth +
    MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT.marketCap.minWidth +
    TOKEN_SELECTOR_TABLE_HORIZONTAL_PADDING,
} as const;

const PrimaryTabItem = memo(
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
        cursor="pointer"
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
PrimaryTabItem.displayName = 'PrimaryTabItem';

const CategoryTabItem = memo(
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
        alignItems="center"
        justifyContent="center"
        px="$2.5"
        py="$1.5"
        borderRadius="$full"
        userSelect="none"
        cursor="pointer"
        backgroundColor={isFocused ? '$bgActive' : '$transparent'}
        onPress={handlePress}
      >
        <SizableText
          numberOfLines={1}
          size="$bodySmMedium"
          color={isFocused ? '$text' : '$textSubdued'}
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);
CategoryTabItem.displayName = 'CategoryTabItem';

function TokenListHeader({
  layoutMode = 'perp',
}: {
  layoutMode?: 'perp' | 'spot' | 'mixed';
}) {
  const intl = useIntl();
  const isSpotLayout = layoutMode === 'spot';
  const isMixedLayout = layoutMode === 'mixed';
  const useFlexibleLayout = isSpotLayout || isMixedLayout;
  const columnLayout = isMixedLayout
    ? MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT
    : SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT;
  const mixedColumnLayout = MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT;
  return (
    <XStack width="100%" px="$4" py="$2">
      <SortableHeaderCell
        field="name"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        })}
        width={useFlexibleLayout ? undefined : 180}
        flex={useFlexibleLayout ? columnLayout.asset.flex : undefined}
        minWidth={useFlexibleLayout ? columnLayout.asset.minWidth : 180}
      />
      <SortableHeaderCell
        field="markPrice"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_last_price,
        })}
        width={useFlexibleLayout ? undefined : 110}
        flex={useFlexibleLayout ? columnLayout.price.flex : undefined}
        minWidth={useFlexibleLayout ? columnLayout.price.minWidth : 110}
      />
      <SortableHeaderCell
        field="change24hPercent"
        label={intl.formatMessage({
          id: ETranslations.perp_token_selector_24h_change,
        })}
        width={useFlexibleLayout ? undefined : 150}
        flex={useFlexibleLayout ? columnLayout.change24h.flex : undefined}
        minWidth={useFlexibleLayout ? columnLayout.change24h.minWidth : 150}
      />
      {isMixedLayout ? (
        <>
          <SortableHeaderCell
            field="fundingRate"
            label={intl.formatMessage({
              id: ETranslations.perp_position_funding,
            })}
            flex={mixedColumnLayout.fundingRate.flex}
            minWidth={mixedColumnLayout.fundingRate.minWidth}
          />
          <SortableHeaderCell
            field="volume24h"
            label={intl.formatMessage({
              id: ETranslations.perp_token_selector_volume,
            })}
            flex={columnLayout.volume.flex}
            minWidth={columnLayout.volume.minWidth}
          />
          <SortableHeaderCell
            field="openInterest"
            label={intl.formatMessage({
              id: ETranslations.perp_token_bar_open_Interest,
            })}
            flex={mixedColumnLayout.openInterest.flex}
            minWidth={mixedColumnLayout.openInterest.minWidth}
          />
          <SortableHeaderCell
            field="marketCap"
            label={intl.formatMessage({
              id: ETranslations.global_market_cap,
            })}
            flex={columnLayout.marketCap.flex}
            minWidth={columnLayout.marketCap.minWidth}
          />
        </>
      ) : null}
      {!isSpotLayout && !isMixedLayout ? (
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
      ) : null}
      {isSpotLayout ? (
        <>
          <SortableHeaderCell
            field="volume24h"
            label={intl.formatMessage({
              id: ETranslations.perp_token_selector_volume,
            })}
            flex={columnLayout.volume.flex}
            minWidth={columnLayout.volume.minWidth}
          />
          <SortableHeaderCell
            field="marketCap"
            label={intl.formatMessage({
              id: ETranslations.global_market_cap,
            })}
            flex={columnLayout.marketCap.flex}
            minWidth={columnLayout.marketCap.minWidth}
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
  const [spotMarketCaps] = useSpotExternalMarketCapsAtom();
  const dynamicTabs: IPerpDynamicTab[] = useMemo(
    () => dynamicTabsRaw ?? [],
    [dynamicTabsRaw],
  );

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

  // Spot data — try cache first, fallback to refresh if empty
  const [spotUniverses, setSpotUniverses] = useState<ISpotUniverse[]>([]);
  const [spotLoading, setSpotLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let universes: ISpotUniverse[] = [];
      try {
        const cachedMeta =
          await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
        universes = cachedMeta.universes ?? [];
        if (!universes.length) {
          await backgroundApiProxy.serviceHyperliquid.refreshSpotMeta();
          const res = await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
          universes = res.universes ?? universes;
        }
      } catch (error) {
        defaultLogger.app.error.log(
          `Failed to load spot meta: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      if (!cancelled) {
        setSpotUniverses(universes);
        setSpotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const activeTab = selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const listRef = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);
  const primaryTabs = useMemo(
    () => buildPrimaryTabs(fixedTabNames),
    [fixedTabNames],
  );
  const categoryTabs = useMemo(
    () =>
      buildPerpTokenSelectorCategoryTabs({
        serverTabs: dynamicTabs,
        fixedTabNames,
      }),
    [dynamicTabs, fixedTabNames],
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
  const displayPrimaryTab = useMemo(
    () => getPerpTokenSelectorPrimaryTabId(displayActiveTab),
    [displayActiveTab],
  );
  const showCategoryTabs = displayPrimaryTab === 'perps';

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
  const setPrimaryTab = useCallback(
    (tab: string) => {
      if (tab === displayPrimaryTab) {
        return;
      }
      setActiveTab(tab);
    },
    [displayPrimaryTab, setActiveTab],
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

  // Snapshot held in state (not ref) so the sort memo only re-runs when we
  // explicitly bump it — sort-config change or first non-empty data arrival.
  const [spotPriceSnapshot, setSpotPriceSnapshot] = useState<ISpotAssetCtxsMap>(
    {},
  );
  const spotPriceMapRef = useRef<ISpotAssetCtxsMap>({});
  useEffect(() => {
    let cancelled = false;
    const updateSpotPriceMapRef = async () => {
      const nextSpotPriceMap = await spotAssetCtxsMapAtom.get();
      if (cancelled) {
        return;
      }
      spotPriceMapRef.current = nextSpotPriceMap;
      setSpotPriceSnapshot((prev) => {
        if (
          Object.keys(prev).length === 0 &&
          Object.keys(nextSpotPriceMap).length > 0
        ) {
          return nextSpotPriceMap;
        }
        return prev;
      });
    };
    void updateSpotPriceMapRef();
    const unsubscribe = spotAssetCtxsMapAtom.sub(() => {
      void updateSpotPriceMapRef();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const spotLastSortRef = useRef<{
    field?: string;
    direction?: string;
  } | null>(null);
  useEffect(() => {
    const field = selectorConfig?.field;
    const direction = selectorConfig?.direction;
    const last = spotLastSortRef.current;
    const sortChanged = last?.field !== field || last?.direction !== direction;
    const snapshotEmpty = Object.keys(spotPriceSnapshot).length === 0;
    if (!sortChanged && !snapshotEmpty) {
      return;
    }
    spotLastSortRef.current = { field, direction };
    setSpotPriceSnapshot(spotPriceMapRef.current);
    if (sortChanged && isPerpTokenSelectorSpotTab(displayActiveTab)) {
      listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    }
  }, [
    selectorConfig?.direction,
    selectorConfig?.field,
    displayActiveTab,
    spotPriceSnapshot,
  ]);

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
      tokenSelectorTab: displayActiveTab,
    });
  }, [actions, displayActiveTab]);

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

  // Layer 1a: perp sort — only reruns when sort config or perp assets change.
  // Never reruns on tab switch, spot WS updates, search, or favorites changes.
  const perpSortedList = useMemo((): ITokenSelectorListItem[] => {
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
        layout: 'desktop',
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

  // Sort against the frozen snapshot so live WS price updates don't trigger
  // an O(n log n) resort on every frame for a 100+ item spot list. Per-row
  // hooks still read live values from spotPriceMap at render time; only the
  // row order is frozen.
  const spotSortedList = useMemo((): ITokenSelectorListItem[] => {
    const perfStartTime = startTokenSelectorPerfMeasure();
    const sortField = selectorConfig?.field ?? '';
    const sortDirection = selectorConfig?.direction ?? 'desc';
    const snapshot = spotPriceSnapshot;

    const mappedEntries = spotUniverses.map((u, index) => {
      const ctx = snapshot[u.name];
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
        layout: 'desktop',
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
    selectorConfig?.field,
    selectorConfig?.direction,
    spotPriceSnapshot,
    spotMarketCaps,
  ]);

  // Layer 2: filter — cheap O(n); no sort computation.
  // Tab switches, search, and favorites changes only reach here.
  // perpSortedList reference is stable unless sort config changes, so ListView
  // bails out of re-rendering rows when spot WS updates trigger a component render.
  const activeTabData = useMemo(() => {
    const perfStartTime = startTokenSelectorPerfMeasure();
    const sortField = selectorConfig?.field ?? '';
    const sortDirection = selectorConfig?.direction ?? 'desc';

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

    if (isPerpTokenSelectorSpotTab(displayPrimaryTab)) {
      result = getSpotListBySearch();
    } else if (isPerpTokenSelectorFavoritesTab(displayPrimaryTab)) {
      const favoriteAssetIds = new Set(
        favoriteItems.map((f: IFavoriteItem) => `${f.dexIndex}-${f.assetId}`),
      );
      result = perpSortedList.filter((item) =>
        favoriteAssetIds.has(`${item.dexIndex}-${item.assetId}`),
      );
    } else if (isPerpTokenSelectorPerpsTab(displayActiveTab)) {
      result = perpSortedList;
    } else {
      const dynamicTab = categoryTabs.find((t) => t.tabId === displayActiveTab);
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
        layout: 'desktop',
        phase: 'active-tab',
        activeTab: displayActiveTab,
        primaryTab: displayPrimaryTab,
        sortField,
        sortDirection,
        perpCount: perpSortedList.length,
        spotCount: spotSortedList.length,
        resultCount: result.length,
        searchQueryLength: searchQuery.length,
        dynamicTabCount: categoryTabs.length,
      });
    }

    return result;
  }, [
    displayActiveTab,
    displayPrimaryTab,
    assetsByDex,
    categoryTabs,
    favoriteItems,
    perpSortedList,
    spotSortedList,
    searchQuery,
    selectorConfig?.direction,
    selectorConfig?.field,
  ]);

  usePerpActiveTabValidation({
    activeTab,
    setActiveTab,
    assetsByDex,
    dynamicTabs: dynamicTabsRaw,
    visibleTabs,
  });

  const keyExtractor = useCallback(
    (item: { dexIndex: number; index: number; assetId?: number }) => {
      const assetId = item.assetId ?? item.index;
      return `${item.dexIndex}-${assetId}`;
    },
    [],
  );
  const desktopListLayout = useMemo((): 'perp' | 'spot' | 'mixed' => {
    if (isPerpTokenSelectorSpotTab(displayPrimaryTab)) {
      return 'spot';
    }
    return 'perp';
  }, [displayPrimaryTab]);
  const desktopTableMinWidth =
    DESKTOP_TOKEN_SELECTOR_TABLE_MIN_WIDTH[desktopListLayout];
  const getRowDesktopLayout = useCallback(
    (item: ITokenSelectorListItem): 'perp' | 'spot' | 'mixed' => {
      if (desktopListLayout === 'mixed') {
        return 'mixed';
      }
      return item.spotUniverse ? 'spot' : 'perp';
    },
    [desktopListLayout],
  );

  const renderItem = useCallback(
    ({ item: mockedToken }: { item: ITokenSelectorListItem }) => (
      <PerpTokenSelectorRow
        mockedToken={mockedToken}
        onPress={handleSelectToken}
        skipMarkRequired
        desktopLayout={getRowDesktopLayout(mockedToken)}
      />
    ),
    [getRowDesktopLayout, handleSelectToken],
  );

  const hasPerpTokenDataLoaded = useMemo(
    () => Boolean(assetsByDex?.some((assets) => assets?.length > 0)),
    [assetsByDex],
  );
  const isFavoritesTab = isPerpTokenSelectorFavoritesTab(displayPrimaryTab);
  const showFavoritesEmpty =
    isFavoritesTab &&
    !searchQuery &&
    isFavoritesReady &&
    hasPerpTokenDataLoaded &&
    favoriteItems.length === 0;
  const isFavoritesLoading =
    isFavoritesTab && !searchQuery && !isFavoritesReady;

  const listEmptyComponent = useMemo(() => {
    if (isPerpTokenSelectorSpotTab(displayPrimaryTab) && spotLoading) {
      return (
        <YStack p="$4" alignItems="center">
          <Spinner size="small" />
        </YStack>
      );
    }
    if (showFavoritesEmpty) {
      return <FavoritesEmptyState />;
    }
    let emptyMessageId: ETranslations = ETranslations.dexmarket_details_nodata;
    if (searchQuery) {
      emptyMessageId = ETranslations.perp_token_selector_empty;
    } else if (!hasPerpTokenDataLoaded || isFavoritesLoading) {
      emptyMessageId = ETranslations.perp_token_selector_loading;
    }
    return (
      <XStack p="$4" justifyContent="center">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: emptyMessageId,
          })}
        </SizableText>
      </XStack>
    );
  }, [
    displayPrimaryTab,
    spotLoading,
    showFavoritesEmpty,
    searchQuery,
    hasPerpTokenDataLoaded,
    isFavoritesLoading,
    intl,
  ]);

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
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            width="100%"
            contentContainerStyle={{ minWidth: '100%' }}
          >
            <XStack minWidth="100%">
              {primaryTabs.map((tab: IPerpDynamicTab) => (
                <PrimaryTabItem
                  key={tab.tabId}
                  id={tab.tabId}
                  name={tab.name}
                  isFocused={displayPrimaryTab === tab.tabId}
                  onPress={setPrimaryTab}
                />
              ))}
            </XStack>
          </ScrollView>
        </XStack>
        {showCategoryTabs ? (
          <XStack bg="$bg">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              width="100%"
              contentContainerStyle={{ minWidth: '100%' }}
            >
              <XStack minWidth="100%" pl="$2" pr="$4" py="$1.5" gap="$2">
                {categoryTabs.map((tab: IPerpDynamicTab) => (
                  <CategoryTabItem
                    key={tab.tabId}
                    id={tab.tabId}
                    name={tab.name}
                    isFocused={displayActiveTab === tab.tabId}
                    onPress={setActiveTab}
                  />
                ))}
              </XStack>
            </ScrollView>
          </XStack>
        ) : null}
        <YStack>
          {showFavoritesEmpty ? (
            <YStack height={350}>
              <FavoritesEmptyState />
            </YStack>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              bounces={false}
              nestedScrollEnabled
              width="100%"
              contentContainerStyle={{
                minWidth: desktopTableMinWidth,
                flexGrow: 1,
              }}
            >
              <YStack flex={1} minWidth={desktopTableMinWidth}>
                <TokenListHeader layoutMode={desktopListLayout} />
                <YStack height={350} minWidth={desktopTableMinWidth}>
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
                </YStack>
              </YStack>
            </ScrollView>
          )}
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
  useEffect(() => {
    const handleTrayNavigate = () => setIsOpen(false);
    appEventBus.on(
      EAppEventBusNames.TrayActionWillNavigate,
      handleTrayNavigate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.TrayActionWillNavigate,
        handleTrayNavigate,
      );
    };
  }, []);
  const triggerLabel = mode === 'spot' ? displayName : `${displayName}USDC`;
  const content = useMemo(
    () => (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.dexmarket_select_token,
        })}
        floatingPanelProps={{
          width: DESKTOP_TOKEN_SELECTOR_PANEL_WIDTH,
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
  const { coin, displayName, mode } = useActiveTradeDisplay();

  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const spotCtxForActiveCoin =
    spotAssetCtx?.coin === coin ? spotAssetCtx.ctx : undefined;
  const change24hPercent =
    mode === 'spot'
      ? spotCtxForActiveCoin?.change24hPercent || 0
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
