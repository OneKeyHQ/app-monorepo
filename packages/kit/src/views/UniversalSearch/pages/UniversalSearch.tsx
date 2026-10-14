import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Empty,
  Icon,
  Page,
  ScrollView,
  SearchBar,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  View,
  XStack,
  YStack,
  isLiquidGlassAvailable,
  useMedia,
} from '@onekeyhq/components';
import { DiscoveryBrowserProviderMirror } from '@onekeyhq/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror';
import {
  TOKEN_SELECTOR_LIST_PADDING_BOTTOM,
  TOKEN_SELECTOR_SEARCH_SECTION_GAP,
  TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/constants';
import {
  MarketSearchSectionTitle,
  MarketSearchShowMoreButton,
  MarketSearchStockSection,
  MarketSearchTokenSection,
  SearchResultsSkeleton,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelectorSearchResults';
import {
  MobileSelectorSearchSkeleton,
  MobileSelectorStockTable,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileMarketSelectorBrowseLists';
import {
  MobileMarketSearchAllList,
  MobileMarketSearchSectionTitle,
  MobileMarketSearchShowMoreButton,
  MobileMarketSearchStockRows,
  MobileMarketSearchTokenList,
  MobileMarketSearchTokenRows,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileMarketTokenSelectorSearchResults';
import { useMarketStockSelectorList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketStockSelectorList';
import { useStockLoadMoreOnScrollEnd } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketTokenSelectorSearchState';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  applyMarketSectionPreview,
  isDetailSearchChainToken,
} from '@onekeyhq/kit/src/views/Market/utils/marketSearchList';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isGoogleSearchItem } from '@onekeyhq/shared/src/consts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getSearchTypeTrackingName } from '@onekeyhq/shared/src/logger/scopes/universalSearch/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EUniversalSearchPages,
  IUniversalSearchParamList,
} from '@onekeyhq/shared/src/routes/universalSearch';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { isMarketSearchStockListing } from '@onekeyhq/shared/src/utils/marketSearchStock';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';
import type {
  IUniversalSearchBatchResult,
  IUniversalSearchResultItem,
} from '@onekeyhq/shared/types/search';
import {
  ESearchStatus,
  EUniversalSearchSource,
  EUniversalSearchType,
} from '@onekeyhq/shared/types/search';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHomeTokenListSnapshot } from '../../../states/jotai/contexts/tokenList/cells';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';
import { MarketWatchListProviderMirror } from '../../Market/MarketWatchListProviderMirror';
import { MarketWatchListProviderMirrorV2 } from '../../Market/MarketWatchListProviderMirrorV2';
import { MarketTableHeader } from '../components/MarketTableHeader';
import {
  UniversalSearchAccountAssetItem,
  UniversalSearchAddressItem,
  UniversalSearchDappItem,
  UniversalSearchPerpItem,
  UniversalSearchSettingsItem,
  UniversalSearchV2MarketTokenItem,
} from '../components/SearchResultItems';
import {
  UniversalSearchStockTab,
  UniversalSearchTokenTab,
  toUniversalSearchStockItem,
  useUniversalSearchSelectorTokens,
} from '../components/UniversalSearchMarketResults';
import { useSettingsSearch } from '../hooks/useSettingsSearch';
import { useUniversalSearchMarketPress } from '../hooks/useUniversalSearchMarketPress';
import { UniversalSearchTestIDs } from '../testIDs';
import { isSearchResponseCurrent } from '../universalSearchRun';
import {
  getUniversalSearchTabIndex,
  prioritizeMarketFocusedSections,
  resolveUniversalSearchInitialTabName,
  shouldPrioritizeMarketSearchSections,
} from '../universalSearchTabs';

import { RecentSearched } from './components/RecentSearched';
import { UniversalSearchProviderMirror } from './UniversalSearchProviderMirror';

interface IUniversalSection {
  tabIndex: number;
  title: string;
  type: EUniversalSearchType;
  data: IUniversalSearchResultItem[];
  sliceData?: IUniversalSearchResultItem[];
  showMore?: boolean;
}

// Matches the Market detail selector's search delay.
const SEARCH_DEBOUNCE_MS = 500;
// The longest the other results wait for the stock search's first page.
const STOCK_FIRST_PAGE_WAIT_MS = 3000;
// The modal width every other modal opens at.
const DEFAULT_MODAL_CONTENT_MAX_WIDTH = 640;
const LIQUID_GLASS_SEARCH_BAR_CONTAINER_PROPS = {
  h: 40,
  alignItems: 'center',
} as const;

const getSearchTypes = (): EUniversalSearchType[] => {
  return [
    !platformEnv.isWebDappMode && EUniversalSearchType.Address,
    EUniversalSearchType.MarketStock,
    EUniversalSearchType.V2MarketToken,
    // Hide AccountAssets search in WebDapp mode
    !platformEnv.isWebDappMode && EUniversalSearchType.AccountAssets,
    !platformEnv.isWebDappMode && EUniversalSearchType.Dapp,
    EUniversalSearchType.Perp,
  ].filter(Boolean);
};

const PRIMARY_SEARCH_TYPES: EUniversalSearchType[] = [
  EUniversalSearchType.MarketStock,
  EUniversalSearchType.V2MarketToken,
  EUniversalSearchType.Perp,
];

// Stocks come from the Market selector's paged stock search in the page, not
// from the background search rounds, so they keep their market tags and can
// load further pages.
const isBackgroundSearchType = (type: EUniversalSearchType) =>
  type !== EUniversalSearchType.MarketStock;

// Default scope for the global universal search: every bg-searchable category
// plus Settings, which is injected client-side rather than via the bg search
// types. A caller can pass a narrower `filterTypes` (e.g. the browser tab uses
// `[Dapp]`) to restrict which categories appear.
const getDefaultFilterTypes = (): EUniversalSearchType[] => [
  ...getSearchTypes(),
  EUniversalSearchType.Settings,
];

const DEFAULT_SLICE_LIMIT = 5;
// All previews stocks and tokens like the Market detail selector.
const MARKET_PREVIEW_LIMIT = TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS;
const STOCK_TAB_INDEX = getUniversalSearchTabIndex(
  EUniversalSearchType.MarketStock,
);
const MARKET_TAB_INDEX = getUniversalSearchTabIndex(
  EUniversalSearchType.V2MarketToken,
);
const PRIORITIZED_SECONDARY_TAB_INDEX = getUniversalSearchTabIndex(
  EUniversalSearchType.Perp,
);

const SkeletonItem = () => (
  <XStack py="$2" alignItems="center">
    <Skeleton w="$10" h="$10" radius="round" />
    <YStack ml="$3">
      <Stack py="$1.5">
        <Skeleton h="$3" w="$32" />
      </Stack>
      <Stack py="$1.5">
        <Skeleton h="$3" w="$24" />
      </Stack>
    </YStack>
  </XStack>
);

function ListEmptyComponent() {
  const intl = useIntl();
  return (
    <YStack px="$5">
      <SizableText numberOfLines={1} size="$headingSm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.market_trending })}
      </SizableText>
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
    </YStack>
  );
}

const isStockSection = (tabIndex: number) => tabIndex === STOCK_TAB_INDEX;
const isMarketSection = (tabIndex: number) => tabIndex === MARKET_TAB_INDEX;

export function UniversalSearch({
  filterTypes,
  initialTab,
  source,
}: {
  filterTypes?: EUniversalSearchType[];
  initialTab?: 'market' | 'dapp';
  source: EUniversalSearchSource;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isTravelMode =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
    'travel-mode';
  const { activeAccount } = useActiveAccount({ num: 0 });
  // Home raw list + full fiat map snapshot (PULLed from the BG VM, refreshed on
  // each home structure frame). Keeps the search cache hint alive (do
  // NOT drop the cache) — `getRawTokenList()` also returns the SETTLED owner
  // identity so the `shouldUseTokensCacheData` owner match still holds. Replaces
  // the deleted `allTokenListAtom` / `allTokenListMapAtom`.
  const allTokenList = useHomeTokenListSnapshot();
  const allTokenListMap = allTokenList.map;

  const { result: allAggregateTokenInfo } = usePromiseResult(
    async () => backgroundApiProxy.serviceToken.getAllAggregateTokenInfo(),
    [],
  );
  const { allAggregateTokenMap } = allAggregateTokenInfo ?? {};

  const [sections, setSections] = useState<IUniversalSection[]>([]);
  const [searchStatus, setSearchStatus] = useState<ESearchStatus>(
    ESearchStatus.init,
  );
  const [recommendSections, setRecommendSections] = useState<
    IUniversalSection[]
  >([]);
  const [searchValue, setSearchValue] = useState('');
  const searchBarGlassActive = isLiquidGlassAvailable();

  const [isFocusInMarketRoute, setIsFocusInMarketRoute] = useState(false);
  useListenTabFocusState(ETabRoutes.Market, (isFocus) => {
    setIsFocusInMarketRoute(isFocus);
  });
  const isFocusInMarketTab = shouldPrioritizeMarketSearchSections({
    isFocusInMarketRoute,
    initialTab,
  });

  const searchSettings = useSettingsSearch();

  // The set of result categories this search instance is allowed to surface.
  // Defaults to every category (see the route wrapper); the Discovery browser
  // tab narrows it to `[Dapp]` so market/perp/wallet results don't leak into
  // browser search (OK-56756). The bg search, the settings injection and the
  // trending recommendations are all filtered through this set so a narrowed
  // scope is honored end to end.
  const allowedSearchTypeSet = useMemo(
    () => new Set(filterTypes?.length ? filterTypes : getDefaultFilterTypes()),
    [filterTypes],
  );
  // Plain O(1) Set lookups — no useMemo needed; each boolean is stable by value
  // whenever allowedSearchTypeSet is.
  const shouldIncludeSettings = allowedSearchTypeSet.has(
    EUniversalSearchType.Settings,
  );
  const shouldIncludeMarketTrending =
    !isTravelMode &&
    allowedSearchTypeSet.has(EUniversalSearchType.V2MarketToken);

  const tabTitles = useMemo(() => {
    return [
      intl.formatMessage({
        id: ETranslations.global_all,
      }),
      !platformEnv.isWebDappMode &&
        intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_wallets,
        }),
      intl.formatMessage({
        id: ETranslations.perps_token_selector_stocks,
      }),
      intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      }),
      intl.formatMessage({
        id: ETranslations.global_perp,
      }),
      // Include My Assets tab only when not in WebDapp mode
      !platformEnv.isWebDappMode &&
        intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_my_assets,
        }),
      !platformEnv.isWebDappMode &&
        intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_dapps,
        }),
      !platformEnv.isWeb &&
        intl.formatMessage({
          id: ETranslations.global_settings,
        }),
    ].filter(Boolean);
  }, [intl]);

  const initialTabName = useMemo(
    () =>
      resolveUniversalSearchInitialTabName({
        initialTab,
        allTabTitle: tabTitles[0],
        dappTabTitle: intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_dapps,
        }),
      }),
    [initialTab, intl, tabTitles],
  );

  const [filterType, setFilterType] = useState(tabTitles[0]);
  const focusedTab = useSharedValue(tabTitles[0]);
  const handleTabPress = useCallback(
    (name: string) => {
      setFilterType(name);
      focusedTab.value = name;
    },
    [focusedTab],
  );
  // The query of the paged stock search; empty when stocks are out of scope.
  const [stockQuery, setStockQuery] = useState('');
  const isStockSearchInScope = allowedSearchTypeSet.has(
    EUniversalSearchType.MarketStock,
  );
  const stockResult = useMarketStockSelectorList({
    query: stockQuery,
    searchOnly: true,
  });
  const stockSection = useMemo<IUniversalSection | undefined>(() => {
    // A failed first page keeps the section so it can offer a retry.
    if (
      !stockQuery ||
      (stockResult.items.length === 0 && !stockResult.isError)
    ) {
      return undefined;
    }
    const data = stockResult.items.map(toUniversalSearchStockItem);
    return {
      tabIndex: STOCK_TAB_INDEX,
      type: EUniversalSearchType.MarketStock,
      title: intl.formatMessage({
        id: ETranslations.perps_token_selector_stocks,
      }),
      // The All preview is applied with the token section below.
      data,
    };
  }, [intl, stockQuery, stockResult.isError, stockResult.items]);
  // The background results plus the stock section, in tab order.
  const displaySections = useMemo(() => {
    const merged = stockSection
      ? [...sections, stockSection].toSorted((a, b) => a.tabIndex - b.tabIndex)
      : sections;
    return applyMarketSectionPreview(merged, {
      stockTabIndex: STOCK_TAB_INDEX,
      tokenTabIndex: MARKET_TAB_INDEX,
      previewLimit: MARKET_PREVIEW_LIMIT,
      stockCanLoadMore: stockResult.canLoadMore,
    });
  }, [sections, stockResult.canLoadMore, stockSection]);
  const tokenSectionItems = useMemo(
    () =>
      displaySections.find((section) => section.tabIndex === MARKET_TAB_INDEX)
        ?.data ?? [],
    [displaySections],
  );
  const selectorTokens = useUniversalSearchSelectorTokens(tokenSectionItems);

  // Tabs without results stay hidden.
  const visibleTabTitles = useMemo(() => {
    const sectionTitles = new Set(
      displaySections
        .filter((section) => section.data.length > 0)
        .map((section) => section.title),
    );
    return tabTitles.filter(
      (title, index) => index === 0 || sectionTitles.has(title),
    );
  }, [displaySections, tabTitles]);

  // Results wait for the stock search too, so a stock section landing later
  // does not push the other results down; but a slow stock search holds them
  // for at most STOCK_FIRST_PAGE_WAIT_MS after the rest have arrived.
  // The wait is tracked per search run, not per query, so searching the same
  // query again waits again.
  const isAwaitingStockFirstPage = Boolean(stockQuery) && stockResult.isLoading;
  const searchRunRef = useRef(0);
  const [searchRun, setSearchRun] = useState(0);
  const [stockWaitExpiredRun, setStockWaitExpiredRun] = useState(-1);
  const isHoldingForStocks =
    searchStatus === ESearchStatus.done && isAwaitingStockFirstPage;
  useEffect(() => {
    if (!isHoldingForStocks) {
      return;
    }
    const timer = setTimeout(() => {
      setStockWaitExpiredRun(searchRun);
    }, STOCK_FIRST_PAGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [isHoldingForStocks, searchRun]);
  const isStockWaitExpired = stockWaitExpiredRun === searchRun;
  const resultStatus =
    isHoldingForStocks && !isStockWaitExpired
      ? ESearchStatus.loading
      : searchStatus;

  // The selected tab may have been hidden (e.g. an `initialTab` preset whose
  // module returned no results). Fall back to the "All" tab so the result list
  // still shows the available results instead of an empty state.
  const activeTab = useMemo(
    () => (visibleTabTitles.includes(filterType) ? filterType : tabTitles[0]),
    [visibleTabTitles, filterType, tabTitles],
  );

  const isInAllTab = useMemo(() => {
    return activeTab === tabTitles[0];
  }, [activeTab, tabTitles]);

  // Reset the active tab to the initial tab whenever a new search starts.
  // The TabBar is only rendered in the `done` state and is unmounted while
  // `loading`, so resetting here (before it re-mounts) guarantees it re-mounts
  // already focused on the initial tab. Resetting on `done` instead is
  // unreliable: the TabBar re-mounts initializing its internal `currentTab`
  // from the previous (stale) `focusedTab`, and a deferred programmatic write
  // can be dropped by its mount-time state initialization — leaving the
  // highlight stuck on the old tab while the result list already shows all
  // modules. Covers both typing and recent-search fill, since both enter
  // `loading` before `done`.
  useEffect(() => {
    if (searchStatus === ESearchStatus.loading) {
      if (focusedTab.value !== initialTabName) {
        focusedTab.value = initialTabName;
      }
      setFilterType(initialTabName);
    }
  }, [focusedTab, searchStatus, initialTabName]);

  // The loading-phase reset above points `focusedTab` at `initialTabName`, which
  // can end up hidden when that preset module returns no results (see
  // `visibleTabTitles`). The TabBar seeds its highlight from `focusedTab.value`
  // at mount, so a hidden value would leave the bar with no active tab while the
  // list already falls back to the All results. Correct it synchronously here —
  // before the TabBar mounts in the `done` branch — to the resolved, always
  // visible `activeTab`. This is a render-time fix (not a deferred write), so it
  // is applied at mount-seed time rather than being dropped by it.
  if (
    resultStatus === ESearchStatus.done &&
    focusedTab.value !== activeTab &&
    !visibleTabTitles.includes(focusedTab.value)
  ) {
    focusedTab.value = activeTab;
    // Commit `filterType` to the resolved fallback too. Otherwise it keeps the
    // hidden preset (e.g. "Dapps"): once that preset's deferred results arrive
    // and its tab becomes visible again, `activeTab` would jump back to the
    // preset and the content list would re-filter to it — while the TabBar,
    // already mounted and seeded to the always-visible fallback, keeps
    // highlighting it, leaving the highlight out of sync with the content.
    // Pinning `filterType` here keeps the user on the fallback so both stay in
    // sync.
    // This guard never fires mid-swipe, where `filterType` already equals
    // `activeTab` (only `focusedTab` is mid-transition).
    if (filterType !== activeTab) {
      setFilterType(activeTab);
    }
  }

  const shouldUseTokensCacheData = useMemo(() => {
    return (
      allTokenList &&
      allTokenListMap &&
      allTokenList.accountId === activeAccount?.account?.id &&
      allTokenList.networkId === activeAccount?.network?.id
    );
  }, [
    allTokenList,
    allTokenListMap,
    activeAccount?.account?.id,
    activeAccount?.network?.id,
  ]);

  const fetchRecommendList = useCallback(async () => {
    // Trending recommendations are market tokens; skip them when market is out
    // of scope (e.g. browser search) so the empty state stays dapp-only.
    if (!shouldIncludeMarketTrending) {
      setRecommendSections([]);
      return;
    }

    const searchResultSections: IUniversalSection[] = [];

    const result =
      await backgroundApiProxy.serviceUniversalSearch.universalSearchRecommend({
        searchTypes: [EUniversalSearchType.V2MarketToken],
      });

    if (result?.[EUniversalSearchType.V2MarketToken]?.items?.length) {
      searchResultSections.push({
        tabIndex: MARKET_TAB_INDEX,
        type: EUniversalSearchType.V2MarketToken,
        title: intl.formatMessage({ id: ETranslations.market_trending }),
        data: result[EUniversalSearchType.V2MarketToken]
          .items as IUniversalSearchResultItem[],
      });
    }
    setRecommendSections(searchResultSections);
  }, [intl, shouldIncludeMarketTrending]);

  useEffect(() => {
    void fetchRecommendList();
  }, [fetchRecommendList]);

  const searchInputRef = useRef<string>('');
  const getSearchInput = useCallback(() => searchInputRef.current, []);

  const effectivePrimaryTypes = useMemo(
    () =>
      PRIMARY_SEARCH_TYPES.filter(
        (type) =>
          isBackgroundSearchType(type) && allowedSearchTypeSet.has(type),
      ),
    [allowedSearchTypeSet],
  );
  const effectiveDeferredTypes = useMemo(
    () =>
      getSearchTypes().filter(
        (type) =>
          isBackgroundSearchType(type) &&
          !PRIMARY_SEARCH_TYPES.includes(type) &&
          allowedSearchTypeSet.has(type),
      ),
    [allowedSearchTypeSet],
  );

  // The search category that the `initialTab` preset selects. The Discovery
  // browser tab presets `dapp`, whose results arrive in the DEFERRED round.
  const initialTabSearchType = useMemo<EUniversalSearchType | undefined>(() => {
    if (initialTab === 'market') {
      return EUniversalSearchType.V2MarketToken;
    }
    if (initialTab === 'dapp') {
      return EUniversalSearchType.Dapp;
    }
    return undefined;
  }, [initialTab]);

  // When the preset tab's results come from the DEFERRED round (e.g. Dapp for
  // the browser tab), painting `done` right after the PRIMARY round renders a
  // result list that has no preset section yet — so `activeTab` falls back to
  // "All" and surfaces market until the deferred round lands, and the tab
  // highlight/content desync only clears after the user toggles tabs
  // (OK-56756). Hold the loading skeleton through the deferred round so the
  // first (and only) `done` paint already contains the preset section and lands
  // on it directly. Presets served by the primary round (market) and the
  // preset-less global search keep the fast partial paint.
  const deferDonePaintUntilPresetReady = useMemo(
    () =>
      !!initialTabSearchType &&
      !PRIMARY_SEARCH_TYPES.includes(initialTabSearchType) &&
      allowedSearchTypeSet.has(initialTabSearchType),
    [initialTabSearchType, allowedSearchTypeSet],
  );

  const buildSectionData = useCallback((data: IUniversalSearchResultItem[]) => {
    return {
      data,
      sliceData: data.slice(0, DEFAULT_SLICE_LIMIT),
      showMore: data.length > DEFAULT_SLICE_LIMIT,
    };
  }, []);

  const buildDappSectionData = useCallback(
    (data: IUniversalSearchResultItem[]) => {
      const googleSearchIndex = data.findIndex(
        (item) =>
          item.type === EUniversalSearchType.Dapp &&
          isGoogleSearchItem(item.payload?.dappId),
      );

      if (googleSearchIndex === -1) {
        return buildSectionData(data);
      }

      const googleSearchItem = data[googleSearchIndex];
      const otherResults = data.filter(
        (_, index) => index !== googleSearchIndex,
      );
      const slicedOtherResults = otherResults.slice(0, DEFAULT_SLICE_LIMIT);

      return {
        data,
        sliceData: [...slicedOtherResults, googleSearchItem],
        showMore: otherResults.length > DEFAULT_SLICE_LIMIT,
      };
    },
    [buildSectionData],
  );

  const buildSearchResultSections = useCallback(
    ({
      result,
      input,
      includeSettings,
    }: {
      result: IUniversalSearchBatchResult;
      input: string;
      includeSettings?: boolean;
    }): IUniversalSection[] => {
      const searchResultSections: IUniversalSection[] = [];

      if (result?.[EUniversalSearchType.Address]?.items?.length) {
        const data = result[EUniversalSearchType.Address]
          .items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getUniversalSearchTabIndex(EUniversalSearchType.Address),
          type: EUniversalSearchType.Address,
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_wallets,
          }),
          ...buildSectionData(data),
        });
      }

      // Stock listings are left to the stock section, as in the Market
      // detail selector.
      const tokenData = (result?.[EUniversalSearchType.V2MarketToken]?.items ??
        []) as IUniversalSearchResultItem[];
      const chainTokenData = tokenData.filter(
        (item) =>
          item.type === EUniversalSearchType.V2MarketToken &&
          isDetailSearchChainToken(item.payload),
      );
      if (chainTokenData.length) {
        const data = chainTokenData;
        searchResultSections.push({
          tabIndex: getUniversalSearchTabIndex(
            EUniversalSearchType.V2MarketToken,
          ),
          type: EUniversalSearchType.V2MarketToken,
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_tokens,
          }),
          // The All preview is applied with the stock section.
          data,
        });
      }

      if (result?.[EUniversalSearchType.Perp]?.items?.length) {
        const data = result[EUniversalSearchType.Perp]
          .items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getUniversalSearchTabIndex(EUniversalSearchType.Perp),
          type: EUniversalSearchType.Perp,
          title: intl.formatMessage({
            id: ETranslations.global_perp,
          }),
          ...buildSectionData(data),
        });
      }

      if (result?.[EUniversalSearchType.AccountAssets]?.items?.length) {
        const data = result[EUniversalSearchType.AccountAssets]
          .items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getUniversalSearchTabIndex(
            EUniversalSearchType.AccountAssets,
          ),
          type: EUniversalSearchType.AccountAssets,
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_my_assets,
          }),
          ...buildSectionData(data),
        });
      }

      if (result?.[EUniversalSearchType.Dapp]?.items?.length) {
        const data = result[EUniversalSearchType.Dapp]
          .items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getUniversalSearchTabIndex(EUniversalSearchType.Dapp),
          type: EUniversalSearchType.Dapp,
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_dapps,
          }),
          ...buildDappSectionData(data),
        });
      }

      if (includeSettings) {
        const settingsResults = platformEnv.isWeb ? [] : searchSettings(input);
        if (settingsResults.length > 0) {
          const data = settingsResults as IUniversalSearchResultItem[];
          searchResultSections.push({
            tabIndex: getUniversalSearchTabIndex(EUniversalSearchType.Settings),
            type: EUniversalSearchType.Settings,
            title: intl.formatMessage({
              id: ETranslations.global_settings,
            }),
            ...buildSectionData(data),
          });
        }
      }

      return searchResultSections.toSorted((a, b) => a.tabIndex - b.tabIndex);
    },
    [buildDappSectionData, buildSectionData, intl, searchSettings],
  );

  const mergeSearchResultSections = useCallback(
    (
      primarySections: IUniversalSection[],
      deferredSections: IUniversalSection[],
    ): IUniversalSection[] => {
      const sectionMap = new Map<number, IUniversalSection>();
      primarySections.forEach((section) => {
        sectionMap.set(section.tabIndex, section);
      });
      deferredSections.forEach((section) => {
        sectionMap.set(section.tabIndex, section);
      });
      return Array.from(sectionMap.values()).toSorted(
        (a, b) => a.tabIndex - b.tabIndex,
      );
    },
    [],
  );

  const logSearchAnalytics = useCallback(
    (input: string, searchResultSections: IUniversalSection[]) => {
      const filteredSections = searchResultSections.map((section) => ({
        type: section.type,
        count: section.data.filter(
          (item) =>
            !(
              item.type === EUniversalSearchType.Dapp &&
              isGoogleSearchItem(item.payload?.dappId)
            ),
        ).length,
      }));
      const resultCount = filteredSections.reduce((sum, s) => sum + s.count, 0);
      const exposedTypes = filteredSections
        .filter((s) => s.count > 0)
        .map((s) => `${getSearchTypeTrackingName(s.type)}:${s.count}`)
        .join(',');
      defaultLogger.universalSearch.search.universalSearchQuery({
        source,
        searchText: input,
        resultCount,
        exposedTypes,
      });
    },
    [source],
  );

  const isSearchResultStale = useCallback((input: string) => {
    return searchInputRef.current !== input;
  }, []);

  // The background results of the latest search, logged once the stock
  // search has answered too so its count is included, or once the results
  // stop waiting for it.
  const [pendingAnalytics, setPendingAnalytics] = useState<
    { input: string; run: number; sections: IUniversalSection[] } | undefined
  >(undefined);
  useEffect(() => {
    if (!pendingAnalytics) {
      return;
    }
    // A superseded run, including an earlier run of the same query that
    // answered late, is dropped so each search logs once.
    if (
      isSearchResultStale(pendingAnalytics.input) ||
      pendingAnalytics.run !== searchRunRef.current
    ) {
      setPendingAnalytics(undefined);
      return;
    }
    if (
      isStockSearchInScope &&
      stockWaitExpiredRun !== pendingAnalytics.run &&
      (stockQuery !== pendingAnalytics.input || stockResult.isLoading)
    ) {
      return;
    }
    setPendingAnalytics(undefined);
    logSearchAnalytics(
      pendingAnalytics.input,
      stockSection
        ? [...pendingAnalytics.sections, stockSection]
        : pendingAnalytics.sections,
    );
  }, [
    isSearchResultStale,
    isStockSearchInScope,
    logSearchAnalytics,
    pendingAnalytics,
    stockQuery,
    stockResult.isLoading,
    stockSection,
    stockWaitExpiredRun,
  ]);

  const handleTextChange = useDebouncedCallback(async (val: string) => {
    console.log('[universalSearch] handleTextChange: ', val);
    const input = val?.trim?.() || '';
    searchRunRef.current += 1;
    const run = searchRunRef.current;
    setSearchRun(run);
    // Late responses of a superseded run, even of the same query, are dropped
    // so they cannot overwrite this run's results or pending analytics.
    const isResponseStale = () =>
      !isSearchResponseCurrent({
        run,
        input,
        currentRun: searchRunRef.current,
        currentInput: searchInputRef.current,
      });
    setStockQuery(isStockSearchInScope ? input : '');
    if (input) {
      let primarySections: IUniversalSection[] = [];
      const searchParams = {
        input,
        networkId: activeAccount?.network?.id,
        accountId: activeAccount?.account?.id,
        indexedAccountId: activeAccount?.indexedAccount?.id,
        tokenListCache: shouldUseTokensCacheData
          ? allTokenList?.tokens
          : undefined,
        tokenListCacheMap: shouldUseTokensCacheData
          ? allTokenListMap
          : undefined,
        // PR-3 D2=B1 (tokenList cells full-delete): the UI no longer threads the
        // home `aggregateTokensListMapAtom`. The BG
        // `universalSearchOfAccountAssets` SELF-DERIVES the scoped owned
        // sub-token list map for the searched owner (via
        // `serviceToken.getLocalAggregateTokenListMap`) when this is absent, so
        // aggregate sub-token (contract-address) matching is preserved.
        aggregateTokenListCacheMap: undefined,
      };
      try {
        // Skip the primary round entirely when the active scope excludes all
        // primary categories (e.g. browser search scoped to `[Dapp]`).
        if (effectivePrimaryTypes.length > 0) {
          const primaryResult =
            await backgroundApiProxy.serviceUniversalSearch.universalSearch({
              ...searchParams,
              searchTypes: effectivePrimaryTypes,
            });
          if (isResponseStale()) {
            return;
          }

          primarySections = buildSearchResultSections({
            result: primaryResult,
            input,
          });

          // Skip the early partial paint when a deferred preset tab is active,
          // so we never render a `done` state that is missing the preset
          // section (OK-56756). The merged paint below then lands on the preset
          // tab directly instead of falling back to "All" (which shows market).
          if (primarySections.length > 0 && !deferDonePaintUntilPresetReady) {
            setSections(primarySections);
            setSearchStatus(ESearchStatus.done);
          }
        }

        // Mirror the primary round's length guard: skip the deferred bg call
        // when no deferred categories are in scope. Settings is injected
        // client-side via buildSearchResultSections, so still run when it is in
        // scope (the bg call returns empty for an out-of-scope searchTypes set).
        let deferredSections: IUniversalSection[] = [];
        if (effectiveDeferredTypes.length > 0 || shouldIncludeSettings) {
          const deferredResult =
            await backgroundApiProxy.serviceUniversalSearch.universalSearch({
              ...searchParams,
              searchTypes: effectiveDeferredTypes,
            });
          if (isResponseStale()) {
            return;
          }

          deferredSections = buildSearchResultSections({
            result: deferredResult,
            input,
            includeSettings: shouldIncludeSettings,
          });
        }
        const mergedSections = mergeSearchResultSections(
          primarySections,
          deferredSections,
        );
        setSections(mergedSections);
        setSearchStatus(ESearchStatus.done);
        setPendingAnalytics({ input, run, sections: mergedSections });
      } catch (error) {
        if (isResponseStale()) {
          return;
        }
        console.error('[universalSearch] search failed', error);
        if (primarySections.length > 0) {
          setSections(primarySections);
          setSearchStatus(ESearchStatus.done);
          setPendingAnalytics({ input, run, sections: primarySections });
          return;
        }
        setSections([]);
        setSearchStatus(ESearchStatus.done);
      }
    } else {
      setSections([]);
      searchInputRef.current = '';
      setSearchStatus(ESearchStatus.init);
    }
  }, SEARCH_DEBOUNCE_MS);

  const handleChangeText = useCallback((val: string) => {
    console.log('[universalSearch] handleChangeText');
    setSearchValue(val); // Update search value state immediately
    searchInputRef.current = val.trim();
    if (val.trim()) {
      setSearchStatus(ESearchStatus.loading);
    } else {
      setSections([]);
      setStockQuery('');
      setSearchStatus(ESearchStatus.init);
    }
  }, []);

  const handleSearchTextFill = useCallback(
    (text: string) => {
      setSearchValue(text);
      searchInputRef.current = text.trim();
      // Set loading status to show skeleton screen
      setSearchStatus(ESearchStatus.loading);
      // Trigger search with the filled text
      void handleTextChange(text);
    },
    [handleTextChange],
  );

  const filterSections = useMemo(() => {
    if (isInAllTab) {
      const sectionsWithSliceData = displaySections.map((i) => ({
        ...i,
        data: i.sliceData ?? i.data,
      }));

      // When focused in Market tab, prioritize Stocks, then Tokens, then Perps.
      if (isFocusInMarketTab) {
        return prioritizeMarketFocusedSections(sectionsWithSliceData, {
          stocks: STOCK_TAB_INDEX,
          market: MARKET_TAB_INDEX,
          perp: PRIORITIZED_SECONDARY_TAB_INDEX,
        });
      }

      return sectionsWithSliceData;
    }
    return displaySections.filter((i) => i.title === activeTab);
  }, [activeTab, displaySections, isFocusInMarketTab, isInAllTab]);

  // Searches that cover stocks or tokens follow the Market detail selector on
  // both desktop and mobile: its skeleton under a tab bar that already shows
  // All, its Stocks, Tokens and All lists, and a fixed 10px under the tab bar.
  const isMarketSearch =
    isStockSearchInScope ||
    allowedSearchTypeSet.has(EUniversalSearchType.V2MarketToken);
  const renderSectionHeader = useCallback(
    ({ section }: { section: IUniversalSection }) => {
      return (
        <YStack bg="$bgApp">
          <XStack h="$9" ai="center">
            <SizableText px="$5" size="$headingSm" color="$textSubdued">
              {section.title}
            </SizableText>
          </XStack>
        </YStack>
      );
    },
    [],
  );

  const renderRecommendSectionHeader = useCallback(
    ({ section }: { section: IUniversalSection }) => {
      return (
        <YStack bg="$bgApp">
          <XStack h="$9" ai="center">
            <SizableText px="$5" size="$headingSm" color="$textSubdued">
              {section.title}
            </SizableText>
          </XStack>
          {isMarketSection(section.tabIndex) ? <MarketTableHeader /> : null}
        </YStack>
      );
    },
    [],
  );

  const pressMarketItem = useUniversalSearchMarketPress({
    source,
    getSearchInput,
  });
  const handleStockRowPress = useCallback(
    (stock: IMarketStockPublicItem) => {
      pressMarketItem(toUniversalSearchStockItem(stock));
    },
    [pressMarketItem],
  );
  const { itemByTokenId } = selectorTokens;
  const handleTokenRowPress = useCallback(
    (token: IMarketToken) => {
      const item = itemByTokenId.get(token.id);
      if (item) {
        pressMarketItem(item);
      }
    },
    [itemByTokenId, pressMarketItem],
  );

  const stocksTabTitle = useMemo(
    () => intl.formatMessage({ id: ETranslations.perps_token_selector_stocks }),
    [intl],
  );
  const tokensTabTitle = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      }),
    [intl],
  );
  const isInStocksTab = activeTab === stocksTabTitle;
  const isInTokensTab = activeTab === tokensTabTitle;
  // Stocks list every page where they are the only results.
  const isLoneStockSection =
    stockResult.items.length > 0 &&
    displaySections.every(
      (section) =>
        section.tabIndex === STOCK_TAB_INDEX || section.data.length === 0,
    );
  // All pages through the selector's scroll hook when stocks stand alone.
  const handleMarketAllScroll = useStockLoadMoreOnScrollEnd(
    stockResult,
    isInAllTab && isLoneStockSection,
  );
  const {
    isError: isStockError,
    isLoadingMore: isLoadingMoreStocks,
    isLoadMoreError: isLoadMoreStocksError,
    loadMore: loadMoreStocks,
    refresh: refreshStocks,
  } = stockResult;

  const renderSectionFooter = useCallback(
    ({ section }: { section: IUniversalSection }) => {
      if (isInAllTab && section.showMore) {
        return (
          <ListItem
            testID={UniversalSearchTestIDs.showMoreBtn}
            onPress={() => {
              handleTabPress(section.title);
            }}
          >
            <XStack ai="center" gap="$2">
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.global_show_more,
                })}
              </SizableText>
              <Icon
                name="ChevronRightSmallOutline"
                size="$4"
                color="$iconSubdued"
              />
            </XStack>
          </ListItem>
        );
      }
      return null;
    },
    [handleTabPress, intl, isInAllTab],
  );

  const renderItem = useCallback(
    ({ item }: { item: IUniversalSearchResultItem }) => {
      switch (item.type) {
        case EUniversalSearchType.Address:
          return (
            <UniversalSearchAddressItem
              item={item}
              contextNetworkId={activeAccount?.network?.id}
              getSearchInput={getSearchInput}
              source={source}
            />
          );
        // Search results render through the Market selector's lists; only
        // the trending list before typing reaches here.
        case EUniversalSearchType.MarketStock:
        case EUniversalSearchType.V2MarketToken:
          return (
            <UniversalSearchV2MarketTokenItem
              item={item}
              isTrending={searchStatus === ESearchStatus.init}
              getSearchInput={getSearchInput}
              source={source}
            />
          );
        case EUniversalSearchType.AccountAssets:
          return (
            <UniversalSearchAccountAssetItem
              item={item}
              allAggregateTokenMap={allAggregateTokenMap}
              getSearchInput={getSearchInput}
              source={source}
            />
          );
        case EUniversalSearchType.Dapp:
          return (
            <UniversalSearchDappItem
              item={item}
              getSearchInput={getSearchInput}
              source={source}
            />
          );
        case EUniversalSearchType.Perp:
          return (
            <UniversalSearchPerpItem
              item={item}
              getSearchInput={getSearchInput}
              source={source}
            />
          );
        case EUniversalSearchType.Settings:
          return (
            <UniversalSearchSettingsItem
              item={item}
              getSearchInput={getSearchInput}
              source={source}
            />
          );
        default:
          return null;
      }
    },
    [
      activeAccount?.network?.id,
      searchStatus,
      allAggregateTokenMap,
      getSearchInput,
      source,
    ],
  );

  const keyExtractor = useCallback(
    (item: IUniversalSearchResultItem, index: number): string => {
      const { type, payload } = item;
      switch (type) {
        case EUniversalSearchType.Address:
          return `${type}-${
            payload.account?.id ??
            payload.indexedAccount?.id ??
            payload.wallet?.id ??
            index
          }-${payload.network?.id ?? ''}`;
        case EUniversalSearchType.MarketStock:
          return `${type}-stock:${payload.stockId}`;
        case EUniversalSearchType.V2MarketToken:
          return isMarketSearchStockListing(payload)
            ? `${type}-stock:${payload.stockId}`
            : `${type}-${payload.address ?? payload.symbol}-${index}`;
        case EUniversalSearchType.AccountAssets:
          return `${type}-${
            payload.token.address ?? payload.token.symbol
          }-${index}`;
        case EUniversalSearchType.Dapp:
          return `${type}-${payload.dappId ?? index}`;
        case EUniversalSearchType.Perp:
          return `${type}-${payload.name}-${index}`;
        case EUniversalSearchType.Settings:
          return `${type}-${payload.title}-${index}`;
        default:
          return String(index);
      }
    },
    [],
  );

  // The selector's 10px between its search field and its tabs.
  const searchBarGap = isMarketSearch ? '$2.5' : '$2';
  const loadingTabTitles = useMemo(() => [tabTitles[0]], [tabTitles]);
  const loadingFocusedTab = useSharedValue(tabTitles[0]);

  // All builds its stock and token sections from the Market detail
  // selector's own All sections (desktop or mobile), so both entries share
  // one implementation; the other result types follow with the same titles.
  // Every All section's Show more, like the selector's stock and token ones.
  const ShowMoreButton = gtMd
    ? MarketSearchShowMoreButton
    : MobileMarketSearchShowMoreButton;
  const renderMarketAll = useCallback(() => {
    const stockLoadMore = isLoneStockSection
      ? {
          isLoadingMore: isLoadingMoreStocks,
          isLoadMoreError: isLoadMoreStocksError,
          onRetry: () => void loadMoreStocks(),
        }
      : undefined;
    const getStockProps = (section: IUniversalSection) => ({
      items: stockResult.items.slice(0, section.data.length),
      isError: isStockError,
      showMore: Boolean(section.showMore),
      onShowMore: () => handleTabPress(section.title),
      onRetry: () => void refreshStocks(),
      onPress: handleStockRowPress,
      loadMore: stockLoadMore,
    });
    // Any other result type: its own rows under the selector's Show more.
    const renderOtherRows = (section: IUniversalSection) => (
      <>
        {section.data.map((item, index) => (
          <Fragment key={keyExtractor(item, index)}>
            {renderItem({ item })}
          </Fragment>
        ))}
        {section.showMore ? (
          <ShowMoreButton
            testID={UniversalSearchTestIDs.showMoreBtn}
            onPress={() => handleTabPress(section.title)}
          />
        ) : null}
      </>
    );

    if (!gtMd) {
      return (
        <MobileMarketSearchAllList
          sections={filterSections.map((section) => {
            let body: ReactNode;
            if (isStockSection(section.tabIndex)) {
              body = (
                <MobileMarketSearchStockRows {...getStockProps(section)} />
              );
            } else if (isMarketSection(section.tabIndex)) {
              body = (
                <MobileMarketSearchTokenRows
                  entries={selectorTokens.entries.slice(0, section.data.length)}
                  showMore={Boolean(section.showMore)}
                  onShowMore={() => handleTabPress(section.title)}
                  onPress={pressMarketItem}
                />
              );
            } else {
              body = renderOtherRows(section);
            }
            return {
              key: String(section.tabIndex),
              title: section.title,
              body,
            };
          })}
          onScroll={handleMarketAllScroll}
        />
      );
    }

    return (
      <ScrollView
        flex={1}
        contentContainerStyle={{
          paddingBottom: TOKEN_SELECTOR_LIST_PADDING_BOTTOM,
        }}
        onScroll={handleMarketAllScroll}
        scrollEventThrottle={64}
        keyboardShouldPersistTaps="handled"
      >
        {filterSections.map((section, sectionIndex) => {
          let content: ReactNode;
          if (isStockSection(section.tabIndex)) {
            content = (
              <MarketSearchStockSection
                {...getStockProps(section)}
                titleBg="$bgApp"
              />
            );
          } else if (isMarketSection(section.tabIndex)) {
            content = (
              <MarketSearchTokenSection
                items={selectorTokens.tokens.slice(0, section.data.length)}
                showMore={Boolean(section.showMore)}
                onShowMore={() => handleTabPress(section.title)}
                onPress={handleTokenRowPress}
                titleBg="$bgApp"
              />
            );
          } else {
            content = (
              <YStack>
                <MarketSearchSectionTitle title={section.title} bg="$bgApp" />
                {renderOtherRows(section)}
              </YStack>
            );
          }
          return (
            <Fragment key={section.tabIndex}>
              {sectionIndex > 0 ? (
                <Stack h={TOKEN_SELECTOR_SEARCH_SECTION_GAP} />
              ) : null}
              {content}
            </Fragment>
          );
        })}
      </ScrollView>
    );
  }, [
    filterSections,
    gtMd,
    handleMarketAllScroll,
    handleStockRowPress,
    handleTabPress,
    handleTokenRowPress,
    isLoadMoreStocksError,
    isLoadingMoreStocks,
    isLoneStockSection,
    isStockError,
    keyExtractor,
    loadMoreStocks,
    pressMarketItem,
    refreshStocks,
    renderItem,
    ShowMoreButton,
    selectorTokens.entries,
    selectorTokens.tokens,
    stockResult.items,
  ]);

  const renderResult = useCallback(() => {
    const noResultsComponent = (
      <Empty
        illustration="QuestionMark"
        title={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
        description={intl.formatMessage({
          id: ETranslations.global_search_no_results_desc,
        })}
      />
    );

    switch (resultStatus) {
      case ESearchStatus.init:
        if (isTravelMode) {
          return noResultsComponent;
        }
        return (
          <SectionList
            stickySectionHeadersEnabled
            renderSectionHeader={renderRecommendSectionHeader}
            sections={recommendSections}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={
              <RecentSearched
                filterTypes={filterTypes}
                onSearchTextFill={handleSearchTextFill}
              />
            }
            ListEmptyComponent={
              shouldIncludeMarketTrending ? <ListEmptyComponent /> : null
            }
            estimatedItemSize="$16"
            ListFooterComponent={<Stack h="$16" />}
            keyboardShouldPersistTaps="handled"
          />
        );

      case ESearchStatus.loading:
        if (isMarketSearch) {
          return (
            <>
              <Tabs.TabBar
                key="search-tabs-loading"
                scrollable
                tabNames={loadingTabTitles}
                onTabPress={noop}
                focusedTab={loadingFocusedTab}
              />
              {gtMd ? (
                <SearchResultsSkeleton />
              ) : (
                <MobileSelectorSearchSkeleton />
              )}
            </>
          );
        }
        return (
          <YStack px="$5" pt="$5">
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </YStack>
        );

      case ESearchStatus.done: {
        let content: ReactNode;
        if (isMarketSearch && isInStocksTab && stockResult.items.length > 0) {
          content = gtMd ? (
            <UniversalSearchStockTab
              result={stockResult}
              onPress={pressMarketItem}
            />
          ) : (
            // Mobile lists carry no column header, so the tab keeps its
            // section title like the other type tabs.
            <MobileSelectorStockTable
              result={stockResult}
              onItemPress={handleStockRowPress}
              listHeader={
                <MobileMarketSearchSectionTitle title={stocksTabTitle} />
              }
            />
          );
        } else if (
          isMarketSearch &&
          isInTokensTab &&
          selectorTokens.tokens.length > 0
        ) {
          content = gtMd ? (
            <UniversalSearchTokenTab
              tokens={selectorTokens.tokens}
              itemByTokenId={selectorTokens.itemByTokenId}
              onPress={pressMarketItem}
            />
          ) : (
            <MobileMarketSearchTokenList
              entries={selectorTokens.entries}
              onPress={pressMarketItem}
              listHeader={
                <MobileMarketSearchSectionTitle title={tokensTabTitle} />
              }
            />
          );
        } else if (isMarketSearch && isInAllTab && filterSections.length > 0) {
          content = renderMarketAll();
        } else {
          content = (
            <SectionList
              key={`search-results-${isInAllTab ? 'all' : activeTab}`}
              // In a stock or token search this list only serves a single-type
              // tab, whose section title just repeats the tab name, so it
              // scrolls away.
              stickySectionHeadersEnabled={!isMarketSearch}
              sections={filterSections}
              renderSectionHeader={renderSectionHeader}
              renderSectionFooter={renderSectionFooter}
              ListEmptyComponent={noResultsComponent}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              estimatedItemSize="$16"
              ListFooterComponent={<Stack h="$16" />}
              keyboardShouldPersistTaps="handled"
            />
          );
        }
        return (
          <>
            {visibleTabTitles.length > 1 || isMarketSearch ? (
              <Tabs.TabBar
                key="search-tabs-done"
                scrollable
                tabNames={visibleTabTitles}
                onTabPress={handleTabPress}
                focusedTab={focusedTab}
              />
            ) : null}
            {isMarketSearch ? (
              // Every tab keeps the selector's fixed 10px under the tab bar;
              // only the list below it scrolls.
              <YStack flex={1} pt="$2.5">
                {content}
              </YStack>
            ) : (
              content
            )}
          </>
        );
      }
      default:
        break;
    }
  }, [
    resultStatus,
    isTravelMode,
    renderSectionHeader,
    renderRecommendSectionHeader,
    recommendSections,
    renderItem,
    keyExtractor,
    filterTypes,
    handleSearchTextFill,
    visibleTabTitles,
    handleTabPress,
    focusedTab,
    isInAllTab,
    activeTab,
    filterSections,
    renderSectionFooter,
    intl,
    shouldIncludeMarketTrending,
    isMarketSearch,
    loadingTabTitles,
    loadingFocusedTab,
    gtMd,
    isInStocksTab,
    isInTokensTab,
    stockResult,
    selectorTokens.tokens,
    selectorTokens.entries,
    selectorTokens.itemByTokenId,
    pressMarketItem,
    stocksTabTitle,
    tokensTabTitle,
    renderMarketAll,
    handleStockRowPress,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_search })}
      />
      <Page.Body>
        <View px="$5" pb={searchBarGap}>
          <SearchBar
            autoFocus
            testID={UniversalSearchTestIDs.searchBar}
            value={searchValue}
            containerProps={
              searchBarGlassActive
                ? LIQUID_GLASS_SEARCH_BAR_CONTAINER_PROPS
                : undefined
            }
            py={searchBarGlassActive ? '$2' : undefined}
            placeholder={intl.formatMessage({
              id: platformEnv.isWebDappMode
                ? ETranslations.global_search
                : ETranslations.global_search_everything,
            })}
            onSearchTextChange={handleTextChange}
            onChangeText={handleChangeText}
          />
        </View>
        {renderResult()}
      </Page.Body>
    </Page>
  );
}

const UniversalSearchWithHomeTokenListProvider = ({
  route,
  navigation,
}: IPageScreenProps<
  IUniversalSearchParamList,
  EUniversalSearchPages.UniversalSearch
>) => {
  const { activeAccount } = useActiveAccount({ num: 0 });

  // Stabilize the fallback reference: getDefaultFilterTypes() returns a fresh
  // array, so computing it inline in the prop would rebuild the downstream
  // allowedSearchTypeSet memo (and its dependents) on every wrapper re-render.
  const routeFilterTypes = route?.params?.filterTypes;
  const source = route?.params?.source ?? EUniversalSearchSource.Unknown;
  const filterTypes = useMemo(
    () => routeFilterTypes || getDefaultFilterTypes(),
    [routeFilterTypes],
  );
  // The route opens at the Market selector's width for its stock and token
  // tables; a search without either (the Discovery dApp search) keeps the
  // regular modal width.
  const hasMarketResults = filterTypes.some(
    (type) =>
      type === EUniversalSearchType.MarketStock ||
      type === EUniversalSearchType.V2MarketToken,
  );
  useLayoutEffect(() => {
    if (!hasMarketResults) {
      navigation.setOptions({
        modalContentMaxWidth: DEFAULT_MODAL_CONTENT_MAX_WIDTH,
      });
    }
  }, [hasMarketResults, navigation]);

  return (
    <HomeTokenListProviderMirrorWrapper
      accountId={activeAccount?.account?.id ?? ''}
    >
      <UniversalSearch
        filterTypes={filterTypes}
        initialTab={route?.params?.initialTab}
        source={source}
      />
    </HomeTokenListProviderMirrorWrapper>
  );
};

const UniversalSearchWithProvider = (
  params: IPageScreenProps<
    IUniversalSearchParamList,
    EUniversalSearchPages.UniversalSearch
  >,
) => (
  <AccountSelectorProviderMirror
    config={{
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: '',
    }}
    enabledNum={[0]}
  >
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <DiscoveryBrowserProviderMirror>
          <UniversalSearchProviderMirror
            storeName={EJotaiContextStoreNames.universalSearch}
          >
            <UniversalSearchWithHomeTokenListProvider {...params} />
          </UniversalSearchProviderMirror>
        </DiscoveryBrowserProviderMirror>
      </MarketWatchListProviderMirror>
    </MarketWatchListProviderMirrorV2>
  </AccountSelectorProviderMirror>
);

export default UniversalSearchWithProvider;
