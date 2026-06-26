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
  NumberSizeableText,
  Page,
  ScrollView,
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
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
  usePerpsTokenSearchAliasesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { prewarmPerpsTokenSelectorImages } from '@onekeyhq/kit/src/utils/coldStartImagePreload';
import { SubtitleText } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  type ISpotAssetCtxsMap,
  usePerpTokenSelectorConfigPersistAtom,
  usePerpTokenSelectorTabsAtom,
  usePerpsFavoritesOrderPersistAtom,
  useSpotAssetCtxsMapAtom,
  useSpotExternalMarketCapsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import perpsUtils, {
  SPOT_SELECTOR_MIN_VOLUME,
  compareSpotMarketCapValues,
  formatSpotPairDisplayName,
  getHyperliquidTokenImageUrl,
  getSpotMarketCapValue,
  getSpotTokenDisplayName,
  getTokenSubtitle,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpTokenSelectorConfig,
  IPerpTokenSortField,
  IPerpsAssetCtx,
  IPerpsFormattedAssetCtx,
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
  usePerpActiveTabValidation,
  usePerpTokenSelector,
  usePerpsFavorites,
} from '../../hooks';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import {
  getTokenSelectorFavoriteItems,
  getTokenSelectorFavoriteSortEntry,
  getTokenSelectorListItemKey,
  sortTokenSelectorFavoriteItems,
} from '../../utils/tokenSelectorFavorites';
import { getCachedPerpsTokenSelectorInitialList } from '../../utils/tokenSelectorInitialListCache';
import {
  markTokenSelectorPerfMeasure,
  startTokenSelectorPerfMeasure,
} from '../../utils/tokenSelectorPerf';
import {
  buildPerpTokenSelectorCategoryTabs,
  buildPerpTokenSelectorTabs,
  buildPrimaryTabs,
  getNextPerpTokenSelectorActiveTabConfig,
  getNextPerpTokenSelectorSortConfig,
  getPerpTokenSelectorDynamicTabItems,
  getPerpTokenSelectorFallbackTabId,
  getPerpTokenSelectorPrimaryTabId,
  getPerpTokenSelectorSortAssetCtxsByDex,
  isPerpTokenSelectorDynamicTabUserSort,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorSortFieldActive,
  isPerpTokenSelectorSpotTab,
  shouldRefreshPerpTokenSelectorSortSnapshot,
} from '../../utils/tokenSelectorTabs';

import { FavoritesEmptyState } from './FavoritesEmptyState';
import {
  type ITokenSelectorListItem,
  SPOT_DEX_INDEX,
} from './PerpTokenSelector';
import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';

import type { LayoutChangeEvent } from 'react-native';

function hasSpotVolumeData(
  spotPriceMap: Record<string, { dayNtlVlm?: string | number } | undefined>,
) {
  return Object.values(spotPriceMap).some(
    (ctx) => Number(ctx?.dayNtlVlm || 0) > 0,
  );
}

// Android FlashList can preserve the pre-sort anchor, which defeats the
// selector's explicit scroll-to-top contract.
const androidSortScrollBehaviorProps: Record<string, unknown> =
  platformEnv.isNativeAndroid
    ? {
        maintainVisibleContentPosition: {
          disabled: true,
        },
      }
    : {};
const IOS_INITIAL_ROWS_SNAPSHOT_COUNT = 9;
const IOS_LIVE_LIST_WINDOW_SIZE = 1;
const TOKEN_SELECTOR_SNAPSHOT_ROW_HEIGHT = 60;
type IInitialRowsSnapshotData = {
  mockedToken: ITokenSelectorListItem;
  assetCtx?: IPerpsFormattedAssetCtx;
};

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
        pt="$0.5"
        pb="$2"
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
    const { handleItemLayout } = useScrollableFilterBar();
    const handlePress = useCallback(() => onPress(id), [id, onPress]);
    const bgColor = isFocused ? '$bgActive' : '$transparent';
    return (
      <XStack
        alignItems="center"
        justifyContent="center"
        px="$2.5"
        py="$1.5"
        borderRadius="$full"
        userSelect="none"
        cursor="pointer"
        backgroundColor={bgColor}
        onPress={handlePress}
        onLayout={(event: LayoutChangeEvent) => handleItemLayout(id, event)}
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

const InitialRowsSnapshotRow = memo(
  ({ assetCtx, mockedToken }: IInitialRowsSnapshotData) => {
    const tokenName = mockedToken.tokenName ?? '';
    const parsed = useMemo(() => parseDexCoin(tokenName), [tokenName]);
    const displayName = mockedToken.spotUniverse
      ? getSpotTokenDisplayName(mockedToken.spotUniverse.baseName)
      : parsed.displayName;
    const imageName = mockedToken.spotUniverse
      ? displayName
      : parsed.displayName;
    const subtitle = mockedToken.tokenSubtitle;
    const maxLeverage = mockedToken.tokenMaxLeverage ?? 0;
    const hasDisplayAssetCtx = Boolean(
      assetCtx?.markPrice && assetCtx.markPrice !== '0',
    );
    const volumeDisplay = hasDisplayAssetCtx
      ? formatDisplayNumber(
          NUMBER_FORMATTER.marketCap(assetCtx?.volume24h ?? '0'),
        )
      : undefined;

    if (!displayName) {
      return null;
    }

    return (
      <XStack
        px="$5"
        py="$2.5"
        minHeight={TOKEN_SELECTOR_SNAPSHOT_ROW_HEIGHT}
        width="100%"
        justifyContent="space-between"
        alignItems="center"
        gap="$2.5"
      >
        <XStack gap="$2" alignItems="center">
          <Icon name="StarOutline" size="$5" color="$iconSubdued" />
          <Token
            size="lg"
            borderRadius="$full"
            tokenImageUri={getHyperliquidTokenImageUrl(imageName)}
            fallbackIcon="CryptoCoinOutline"
          />
        </XStack>
        <YStack gap="$1" flex={1} minWidth={0}>
          <XStack gap="$1.5" alignItems="center" minWidth={0}>
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {displayName}
            </SizableText>
            {maxLeverage > 0 ? (
              <XStack
                borderRadius="$1"
                bg="$bgStrong"
                justifyContent="center"
                alignItems="center"
                px="$1.5"
              >
                <SizableText fontSize={10} color="$textSubdued" lineHeight={16}>
                  {maxLeverage}x
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
          <XStack gap="$1" alignItems="center" minWidth={0}>
            {subtitle ? (
              <SubtitleText subtitle={subtitle} maxWidth={80} />
            ) : null}
            {hasDisplayAssetCtx ? (
              <SizableText size="$bodySm" color="$textSubdued">
                ${volumeDisplay}
              </SizableText>
            ) : (
              <Stack
                width={80}
                height={16}
                borderRadius="$full"
                bg="$bgStrong"
              />
            )}
          </XStack>
        </YStack>
        <YStack gap="$1" alignItems="flex-end">
          {hasDisplayAssetCtx ? (
            <>
              <NumberSizeableText
                formatter="price"
                size="$bodyMdMedium"
                color="$text"
                alignSelf="flex-end"
              >
                {assetCtx?.markPrice}
              </NumberSizeableText>
              <NumberSizeableText
                size="$bodySm"
                alignSelf="flex-end"
                color={
                  (assetCtx?.change24hPercent ?? 0) > 0 ? '$green11' : '$red11'
                }
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns: true }}
              >
                {assetCtx?.change24hPercent.toString()}
              </NumberSizeableText>
            </>
          ) : (
            <>
              <Stack
                width={100}
                height={16}
                borderRadius="$full"
                bg="$bgStrong"
              />
              <Stack
                width={72}
                height={16}
                borderRadius="$full"
                bg="$bgStrong"
              />
            </>
          )}
        </YStack>
      </XStack>
    );
  },
);
InitialRowsSnapshotRow.displayName = 'InitialRowsSnapshotRow';

function MobileTokenSelectorModal({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useHyperliquidActions();
  const { searchQuery, setSearchQuery } = usePerpTokenSelector();

  // Spot data — try cache first, fallback to refresh if empty.
  // Loading is gated below so the default Perps selector path does not spend
  // its first popup frames on spot metadata work.
  const [spotPriceMap] = useSpotAssetCtxsMapAtom();
  const spotPriceMapRef = useRef<ISpotAssetCtxsMap>(spotPriceMap);
  spotPriceMapRef.current = spotPriceMap;
  const [spotUniverses, setSpotUniverses] = useState<ISpotUniverse[]>([]);
  const [spotLoading, setSpotLoading] = useState(true);

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
  const { favoriteItems: perpFavoriteItems, isReady: isPerpFavoritesReady } =
    usePerpsFavorites({ mode: 'perp' });
  const { favoriteItems: spotFavoriteItems, isReady: isSpotFavoritesReady } =
    usePerpsFavorites({ mode: 'spot' });
  const favoriteItems = useMemo(
    () => [...perpFavoriteItems, ...spotFavoriteItems],
    [perpFavoriteItems, spotFavoriteItems],
  );
  const isFavoritesReady = isPerpFavoritesReady && isSpotFavoritesReady;
  const [favoritesOrder] = usePerpsFavoritesOrderPersistAtom();
  const [selectorConfig, setSelectorConfig] =
    usePerpTokenSelectorConfigPersistAtom();
  const [dynamicTabsRaw] = usePerpTokenSelectorTabsAtom();
  const [spotMarketCaps] = useSpotExternalMarketCapsAtom();
  const dynamicTabs = useMemo(() => dynamicTabsRaw ?? [], [dynamicTabsRaw]);
  const activeTab = selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const listRef = useRef<IListViewRef<ITokenSelectorListItem> | null>(null);
  const cachedInitialListRef = useRef<ITokenSelectorListItem[]>(
    getCachedPerpsTokenSelectorInitialList(),
  );
  const initialListRenderedRef = useRef(!platformEnv.isNativeIOS);
  const initialListRenderedIndexesRef = useRef<Set<number>>(new Set());
  const [hasInitialListRendered, setHasInitialListRendered] = useState(
    !platformEnv.isNativeIOS,
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
  const shouldEnableSpotData = useMemo(
    () =>
      isPerpTokenSelectorSpotTab(displayPrimaryTab) ||
      isPerpTokenSelectorFavoritesTab(displayPrimaryTab),
    [displayPrimaryTab],
  );
  const showCategoryTabs = displayPrimaryTab === 'perps';
  const scrollListToTop = useCallback(() => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, []);

  useEffect(() => {
    if (!shouldEnableSpotData) {
      return;
    }
    let cancelled = false;
    void (async () => {
      let universes: ISpotUniverse[] = [];
      try {
        const cachedMeta =
          await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
        universes = cachedMeta.universes ?? [];
        if (!universes.length || !hasSpotVolumeData(spotPriceMapRef.current)) {
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
  }, [shouldEnableSpotData]);

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

  // iOS keeps cached rows visible through the modal transition, then mounts the
  // live FlashList after transitionEnd to keep the popup animation off the JS
  // row-subscription path.
  const [isListReady, setIsListReady] = useState(!platformEnv.isNativeIOS);
  usePageMounted(() => setIsListReady(true));

  // Freeze sort order; only refresh on sort config change or first data arrival.
  // Does NOT track activeTab — tab switches should not refresh the snapshot.
  const ctxSnapshotRef = useRef(assetCtxsByDex);
  const [perpSortSnapshot, setPerpSortSnapshot] = useState(assetCtxsByDex);
  const lastSortRef = useRef<{
    field?: string;
    direction?: string;
    sortSource?: IPerpTokenSelectorConfig['sortSource'];
    sortSourceTab?: IPerpTokenSelectorConfig['sortSourceTab'];
  } | null>(null);
  useEffect(() => {
    const field = selectorConfig?.field;
    const direction = selectorConfig?.direction;
    const sortSource = selectorConfig?.sortSource;
    const sortSourceTab = selectorConfig?.sortSourceTab;
    const last = lastSortRef.current;
    // Also refresh when snapshot is empty (first WS data arrival after mount)
    const snapshotEmpty = !ctxSnapshotRef.current?.some(
      (arr) => arr?.length > 0,
    );
    const shouldRefresh = shouldRefreshPerpTokenSelectorSortSnapshot({
      lastSort: last,
      field,
      direction,
      sortSource,
      sortSourceTab,
      snapshotEmpty,
    });
    if (!shouldRefresh) {
      return;
    }
    lastSortRef.current = { field, direction, sortSource, sortSourceTab };
    ctxSnapshotRef.current = assetCtxsByDex;
    setPerpSortSnapshot(assetCtxsByDex);
    if (
      last?.field !== field ||
      last?.direction !== direction ||
      last?.sortSource !== sortSource ||
      last?.sortSourceTab !== sortSourceTab
    ) {
      scrollListToTop();
    }
  }, [
    selectorConfig?.direction,
    selectorConfig?.field,
    selectorConfig?.sortSource,
    selectorConfig?.sortSourceTab,
    assetCtxsByDex,
    scrollListToTop,
  ]);

  const [spotPriceSnapshot, setSpotPriceSnapshot] = useState<ISpotAssetCtxsMap>(
    {},
  );
  const spotLastSortRef = useRef<{
    field?: string;
    direction?: IPerpTokenSelectorConfig['direction'];
  } | null>(null);
  useEffect(() => {
    if (!shouldEnableSpotData) {
      return;
    }
    const field = selectorConfig?.field;
    const direction = selectorConfig?.direction;
    const snapshotEmpty = Object.keys(spotPriceSnapshot).length === 0;
    const shouldRefresh = shouldRefreshPerpTokenSelectorSortSnapshot({
      lastSort: spotLastSortRef.current,
      field,
      direction,
      snapshotEmpty,
    });
    if (!shouldRefresh) {
      return;
    }
    spotLastSortRef.current = { field, direction };
    setSpotPriceSnapshot(spotPriceMapRef.current);
  }, [
    shouldEnableSpotData,
    selectorConfig?.direction,
    selectorConfig?.field,
    spotPriceMap,
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

  const setActiveTab = useCallback(
    (tab: string) => {
      if (tab === activeTab) {
        return;
      }
      startTransition(() => {
        setSelectorConfig((prev) =>
          getNextPerpTokenSelectorActiveTabConfig({ prev, tab }),
        );
      });
      actions.current.setTradeRouteViewState({
        tokenSelectorTab: tab,
      });
    },
    [actions, activeTab, setSelectorConfig],
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

  // Layer 1: perp sort — always sorts against the frozen snapshot so live WS
  // ticks do not re-sort the full perp universe.
  const perpSortAssetCtxsByDex = getPerpTokenSelectorSortAssetCtxsByDex({
    snapshotAssetCtxsByDex: perpSortSnapshot,
  });
  const perpSortedList = useMemo(() => {
    const perfStartTime = startTokenSelectorPerfMeasure();
    const assetsByDexTyped: IPerpsUniverse[][] = assetsByDex || [];
    const assetCtxsByDexTyped: IPerpsAssetCtx[][] =
      perpSortAssetCtxsByDex || [];

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
    const sortSource = selectorConfig?.sortSource;
    const sortSourceTab = selectorConfig?.sortSourceTab;
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
        sortSource,
        sortSourceTab,
        perpCount: combinedEntries.length,
        resultCount: result.length,
      });
    }

    return result;
  }, [
    assetsByDex,
    computeSortValues,
    perpSortAssetCtxsByDex,
    sortCompare,
    selectorConfig?.direction,
    selectorConfig?.field,
    selectorConfig?.sortSource,
    selectorConfig?.sortSourceTab,
    tokenSearchAliases,
  ]);

  // Layer 1b: spot sort — isolated from perp. Sorts against a frozen snapshot
  // so live WS updates refresh row values without reshuffling the list.
  const { spotSortedList, spotFavoriteSortedList } = useMemo((): {
    spotSortedList: ITokenSelectorListItem[];
    spotFavoriteSortedList: ITokenSelectorListItem[];
  } => {
    if (!shouldEnableSpotData) {
      return {
        spotSortedList: [],
        spotFavoriteSortedList: [],
      };
    }
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

    const sortEntries = (items: typeof mappedEntries) => {
      if (!sortField) {
        return items;
      }
      return [...items].toSorted((a, b) => {
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
    };

    const hasVolumeData = mappedEntries.some((e) => e.volume24h > 0);
    const entries = mappedEntries.filter(
      (e) => !hasVolumeData || e.volume24h >= SPOT_SELECTOR_MIN_VOLUME,
    );
    const sortedEntries = sortEntries(entries);
    const sortedFavoriteEntries = sortEntries(mappedEntries);

    const result = sortedEntries.map((e) => e.item);
    const favoriteResult = sortedFavoriteEntries.map((e) => e.item);
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

    return {
      spotSortedList: result,
      spotFavoriteSortedList: favoriteResult,
    };
  }, [
    shouldEnableSpotData,
    spotUniverses,
    spotPriceSnapshot,
    spotMarketCaps,
    tokenSearchAliases,
    selectorConfig?.field,
    selectorConfig?.direction,
  ]);

  const activeDynamicTabUserSort = isPerpTokenSelectorDynamicTabUserSort({
    activeTab: displayActiveTab,
    sortSource: selectorConfig?.sortSource,
    sortSourceTab: selectorConfig?.sortSourceTab,
  });
  const dynamicSortAssetCtxsByDex = activeDynamicTabUserSort
    ? assetCtxsByDex
    : undefined;

  // Layer 2: filter — cheap O(n) filter; only dynamic user sort sorts the
  // filtered dynamic-token subset against live values.
  // Tab switches and favorites changes only reach here, not the full sort layer.
  const mockedListData = useMemo(() => {
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
      result = getTokenSelectorFavoriteItems({
        favoriteItems,
        favoritesOrder: favoritesOrder.sequence,
        perpItems: perpSortedList,
        spotItems: spotFavoriteSortedList,
      });
      if (sortField) {
        result = sortTokenSelectorFavoriteItems({
          items: result,
          sortField,
          sortDirection,
          getSortEntry: (item, order) =>
            getTokenSelectorFavoriteSortEntry({
              item,
              order,
              spotPriceSnapshot,
              spotMarketCaps,
              perpAssetCtxsByDex: ctxSnapshotRef.current,
              computePerpSortValues: computeSortValues,
            }),
        });
      }
    } else if (isPerpTokenSelectorPerpsTab(displayActiveTab)) {
      result = perpSortedList;
    } else {
      const dynamicTab = categoryTabs.find((t) => t.tabId === displayActiveTab);
      if (dynamicTab) {
        const dynamicItems = getPerpTokenSelectorDynamicTabItems({
          items: perpSortedList,
          tokens: dynamicTab.tokens,
        });
        if (activeDynamicTabUserSort && sortField) {
          result = dynamicItems
            .map((item, index) => {
              const asset = assetsByDex?.[item.dexIndex]?.[item.index];
              const normalizedAssetId =
                item.dexIndex === 1 && item.assetId !== undefined
                  ? item.assetId - XYZ_ASSET_ID_OFFSET
                  : item.assetId;
              const assetCtx =
                normalizedAssetId !== undefined
                  ? dynamicSortAssetCtxsByDex?.[item.dexIndex]?.[
                      normalizedAssetId
                    ]
                  : undefined;
              return {
                item,
                index,
                sortEntry: asset
                  ? {
                      asset,
                      sortValues: computeSortValues(assetCtx),
                    }
                  : undefined,
              };
            })
            .toSorted((a, b) => {
              if (!a.sortEntry || !b.sortEntry) {
                return a.index - b.index;
              }
              return sortCompare(a.sortEntry, b.sortEntry) || a.index - b.index;
            })
            .map(({ item }) => item);
        } else {
          result = dynamicItems;
        }
      } else {
        result = perpSortedList;
      }
    }

    if (perfStartTime !== undefined) {
      markTokenSelectorPerfMeasure(perfStartTime, {
        layout: 'mobile',
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
    activeDynamicTabUserSort,
    assetsByDex,
    categoryTabs,
    favoritesOrder.sequence,
    favoriteItems,
    computeSortValues,
    dynamicSortAssetCtxsByDex,
    perpSortedList,
    selectorConfig?.direction,
    selectorConfig?.field,
    sortCompare,
    spotFavoriteSortedList,
    spotMarketCaps,
    spotPriceSnapshot,
    spotSortedList,
    searchQuery,
  ]);

  useEffect(() => {
    void prewarmPerpsTokenSelectorImages(mockedListData);
  }, [mockedListData]);

  const isDefaultPerpsSelectorView =
    displayActiveTab === DEFAULT_PERP_TOKEN_ACTIVE_TAB &&
    (selectorConfig?.field ?? DEFAULT_PERP_TOKEN_SORT_FIELD) ===
      DEFAULT_PERP_TOKEN_SORT_FIELD &&
    (selectorConfig?.direction ?? DEFAULT_PERP_TOKEN_SORT_DIRECTION) ===
      DEFAULT_PERP_TOKEN_SORT_DIRECTION;
  const shouldUseCachedInitialList =
    platformEnv.isNativeIOS &&
    !searchQuery &&
    isDefaultPerpsSelectorView &&
    mockedListData.length === 0 &&
    cachedInitialListRef.current.length > 0;
  const displayedListData = shouldUseCachedInitialList
    ? cachedInitialListRef.current
    : mockedListData;

  useEffect(() => {
    if (!platformEnv.isNativeIOS) {
      return;
    }
    initialListRenderedRef.current = false;
    initialListRenderedIndexesRef.current.clear();
    setHasInitialListRendered(false);
  }, [activeTab, searchQuery, shouldUseCachedInitialList]);

  usePerpActiveTabValidation({
    activeTab,
    setActiveTab,
    assetsByDex,
    dynamicTabs: dynamicTabsRaw,
    visibleTabs,
  });

  const keyExtractor = useCallback(
    (item: ITokenSelectorListItem) => getTokenSelectorListItemKey(item),
    [],
  );

  const markInitialListRowRendered = useCallback(
    (index: number) => {
      if (initialListRenderedRef.current) {
        return;
      }
      if (index >= IOS_INITIAL_ROWS_SNAPSHOT_COUNT) {
        return;
      }
      initialListRenderedIndexesRef.current.add(index);
      const targetCount = Math.min(
        IOS_INITIAL_ROWS_SNAPSHOT_COUNT,
        displayedListData.length,
      );
      if (initialListRenderedIndexesRef.current.size < targetCount) {
        return;
      }
      initialListRenderedRef.current = true;
      requestAnimationFrame(() => {
        setHasInitialListRendered(true);
      });
    },
    [displayedListData.length],
  );

  const renderItem = useCallback(
    ({
      item: mockedToken,
      index,
    }: {
      item: ITokenSelectorListItem;
      index: number;
    }) => {
      const row = (
        <PerpTokenSelectorRow
          isOnModal
          mockedToken={mockedToken}
          onPress={handleSelectToken}
          skipMarkRequired
        />
      );
      if (
        !platformEnv.isNativeIOS ||
        index >= IOS_INITIAL_ROWS_SNAPSHOT_COUNT
      ) {
        return row;
      }
      return (
        <Stack width="100%" onLayout={() => markInitialListRowRendered(index)}>
          {row}
        </Stack>
      );
    },
    [handleSelectToken, markInitialListRowRendered],
  );

  const handleSortPress = useCallback(
    (field: IPerpTokenSortField) => {
      setSelectorConfig((prev: IPerpTokenSelectorConfig | null) => {
        return getNextPerpTokenSelectorSortConfig({ prev, field });
      });
    },
    [setSelectorConfig],
  );
  const activeSortTab =
    selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB;
  const isVolumeSortActive = isPerpTokenSelectorSortFieldActive({
    activeTab: activeSortTab,
    field: 'volume24h',
    sortField: selectorConfig?.field,
    sortSource: selectorConfig?.sortSource,
    sortSourceTab: selectorConfig?.sortSourceTab,
  });
  const isChangeSortActive = isPerpTokenSelectorSortFieldActive({
    activeTab: activeSortTab,
    field: 'change24hPercent',
    sortField: selectorConfig?.field,
    sortSource: selectorConfig?.sortSource,
    sortSourceTab: selectorConfig?.sortSourceTab,
  });
  let iconName: string;
  if (isVolumeSortActive && selectorConfig?.direction === 'asc') {
    iconName = 'ChevronTopOutline';
  } else if (isVolumeSortActive) {
    iconName = 'ChevronBottomOutline';
  } else {
    iconName = 'ChevronGrabberVerOutline';
  }

  let listEmptyComponent: ReactNode;
  const shouldShowSpotLoadingEmptyState =
    spotLoading && isPerpTokenSelectorSpotTab(displayPrimaryTab);
  const shouldHidePerpsHydratingEmptyState =
    !searchQuery &&
    isPerpTokenSelectorPerpsTab(displayPrimaryTab) &&
    perpSortedList.length === 0;
  const shouldShowInitialRowsSnapshot =
    platformEnv.isNativeIOS &&
    !hasInitialListRendered &&
    !searchQuery &&
    isPerpTokenSelectorPerpsTab(displayPrimaryTab) &&
    displayedListData.length > 0;
  const initialRowsSnapshotData = useMemo<IInitialRowsSnapshotData[]>(() => {
    if (!shouldShowInitialRowsSnapshot) {
      return [];
    }
    return displayedListData
      .slice(0, IOS_INITIAL_ROWS_SNAPSHOT_COUNT)
      .map((mockedToken) => {
        const assetId = mockedToken.assetId;
        const dexIndex = mockedToken.dexIndex;
        const ctxIndex =
          dexIndex === 1 && typeof assetId === 'number'
            ? assetId - XYZ_ASSET_ID_OFFSET
            : assetId;
        const rawAssetCtx =
          typeof ctxIndex === 'number'
            ? assetCtxsByDex?.[dexIndex]?.[ctxIndex]
            : undefined;
        return {
          mockedToken,
          assetCtx: rawAssetCtx
            ? perpsUtils.formatAssetCtx(rawAssetCtx)
            : undefined,
        };
      });
  }, [assetCtxsByDex, displayedListData, shouldShowInitialRowsSnapshot]);
  if (shouldShowSpotLoadingEmptyState) {
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
      <Stack flexShrink={0}>
        <XStack borderBottomWidth="$px" borderBottomColor="$borderSubdued">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            width="100%"
            contentContainerStyle={{ minWidth: '100%' }}
          >
            <XStack minWidth="100%">
              {primaryTabs.map((tab) => (
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
          <Stack>
            <ScrollableFilterBar
              selectedItemId={displayActiveTab}
              itemGap="$2"
              itemPr="$3"
              contentContainerStyle={{
                pl: '$2',
                pr: '$4',
                pt: '$2.5',
                pb: '$1.5',
              }}
            >
              {categoryTabs.map((tab) => (
                <CategoryTabItem
                  key={tab.tabId}
                  id={tab.tabId}
                  name={tab.name}
                  isFocused={displayActiveTab === tab.tabId}
                  onPress={setActiveTab}
                />
              ))}
            </ScrollableFilterBar>
          </Stack>
        ) : null}
      </Stack>
      <XStack px="$4" pt="$3" pb="$0.5" justifyContent="space-between">
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => handleSortPress('volume24h')}
          userSelect="none"
          cursor="default"
        >
          <SizableText
            size="$bodyXs"
            color={isVolumeSortActive ? '$text' : '$textSubdued'}
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
            size="$bodyXs"
            color={isChangeSortActive ? '$text' : '$textSubdued'}
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_last_price,
            })}{' '}
            /{' '}
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_24h_change,
            })}
          </SizableText>
          {isChangeSortActive ? (
            <Icon
              name={
                selectorConfig?.direction === 'asc'
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
        <YStack flex={1}>
          {isListReady ? (
            <ListView
              useFlashList
              key={`${activeTab}-${
                shouldUseCachedInitialList ? 'cached' : 'live'
              }`}
              ref={listRef}
              keyExtractor={keyExtractor}
              estimatedItemSize={TOKEN_SELECTOR_SNAPSHOT_ROW_HEIGHT}
              windowSize={
                platformEnv.isNativeIOS ? IOS_LIVE_LIST_WINDOW_SIZE : 3
              }
              initialNumToRender={
                platformEnv.isNativeIOS ? IOS_INITIAL_ROWS_SNAPSHOT_COUNT : 5
              }
              decelerationRate="normal"
              showsVerticalScrollIndicator
              nestedScrollEnabled={platformEnv.isNativeAndroid}
              {...androidSortScrollBehaviorProps}
              contentContainerStyle={{
                paddingBottom: 10,
              }}
              data={displayedListData}
              renderItem={renderItem}
              ListEmptyComponent={
                shouldHidePerpsHydratingEmptyState ? null : listEmptyComponent
              }
            />
          ) : null}
          {initialRowsSnapshotData.length > 0 ? (
            <YStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              zIndex={1}
              bg="$bgApp"
              pointerEvents="none"
            >
              {initialRowsSnapshotData.map(({ assetCtx, mockedToken }) => (
                <Stack
                  key={`initial-${getTokenSelectorListItemKey(mockedToken)}`}
                  width="100%"
                >
                  <InitialRowsSnapshotRow
                    mockedToken={mockedToken}
                    assetCtx={assetCtx}
                  />
                </Stack>
              ))}
            </YStack>
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
