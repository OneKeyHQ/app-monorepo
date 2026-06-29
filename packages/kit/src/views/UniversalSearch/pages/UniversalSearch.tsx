import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Empty,
  Icon,
  Page,
  SearchBar,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { DiscoveryBrowserProviderMirror } from '@onekeyhq/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror';
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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IUniversalSearchBatchResult,
  IUniversalSearchResultItem,
} from '@onekeyhq/shared/types/search';
import {
  ESearchStatus,
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
import { useSettingsSearch } from '../hooks/useSettingsSearch';
import { UniversalSearchTestIDs } from '../testIDs';

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

const SEARCH_DEBOUNCE_MS = 300;

const getSearchTypes = (): EUniversalSearchType[] => {
  return [
    !platformEnv.isWebDappMode && EUniversalSearchType.Address,
    EUniversalSearchType.V2MarketToken,
    // Hide AccountAssets search in WebDapp mode
    !platformEnv.isWebDappMode && EUniversalSearchType.AccountAssets,
    !platformEnv.isWebDappMode && EUniversalSearchType.Dapp,
    EUniversalSearchType.Perp,
  ].filter(Boolean);
};

const PRIMARY_SEARCH_TYPES: EUniversalSearchType[] = [
  EUniversalSearchType.V2MarketToken,
  EUniversalSearchType.Perp,
];

// Default scope for the global universal search: every bg-searchable category
// plus Settings, which is injected client-side rather than via the bg search
// types. A caller can pass a narrower `filterTypes` (e.g. the browser tab uses
// `[Dapp]`) to restrict which categories appear.
const getDefaultFilterTypes = (): EUniversalSearchType[] => [
  ...getSearchTypes(),
  EUniversalSearchType.Settings,
];

const getTabIndexForSearchType = (searchType: EUniversalSearchType): number => {
  const tabMapping: Record<EUniversalSearchType, number> = {
    [EUniversalSearchType.Address]: 1, // Wallets tab
    [EUniversalSearchType.V2MarketToken]: 2, // Market tab
    [EUniversalSearchType.Perp]: 3, // Perp tab (after Market)
    [EUniversalSearchType.MarketToken]: 0, // Legacy Tokens tab is hidden
    // In WebDapp mode, My Assets tab is hidden
    [EUniversalSearchType.AccountAssets]: platformEnv.isWebDappMode ? 0 : 4,
    // DApps tab index changes based on whether My Assets tab is shown
    [EUniversalSearchType.Dapp]: platformEnv.isWebDappMode ? 4 : 5,
    // Settings tab is last
    [EUniversalSearchType.Settings]: platformEnv.isWebDappMode ? 5 : 6,
  };

  return tabMapping[searchType];
};

const DEFAULT_SLICE_LIMIT = 5;
const MARKET_SLICE_LIMIT = 3;
const MARKET_TAB_INDEX = getTabIndexForSearchType(
  EUniversalSearchType.V2MarketToken,
);
const PRIORITIZED_SECONDARY_TAB_INDEX = getTabIndexForSearchType(
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

const isMarketSection = (tabIndex: number) => tabIndex === MARKET_TAB_INDEX;

export function UniversalSearch({
  filterTypes,
  initialTab,
}: {
  filterTypes?: EUniversalSearchType[];
  initialTab?: 'market' | 'dapp';
}) {
  const intl = useIntl();
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

  const [isFocusInMarketTab, setIsFocusInMarketTab] = useState(false);
  useListenTabFocusState(ETabRoutes.Market, (isFocus) => {
    setIsFocusInMarketTab(isFocus);
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
  const shouldIncludeMarketTrending = allowedSearchTypeSet.has(
    EUniversalSearchType.V2MarketToken,
  );

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
        id: ETranslations.global_market,
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

  const initialTabName = useMemo(() => {
    if (initialTab === 'market') {
      return intl.formatMessage({ id: ETranslations.global_market });
    }
    if (initialTab === 'dapp') {
      return intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_dapps,
      });
    }
    return tabTitles[0];
  }, [initialTab, intl, tabTitles]);

  const [filterType, setFilterType] = useState(tabTitles[0]);
  const focusedTab = useSharedValue(tabTitles[0]);
  const handleTabPress = useCallback(
    (name: string) => {
      setFilterType(name);
      focusedTab.value = name;
    },
    [focusedTab],
  );
  // Only surface tabs that actually have results for the current search. The
  // leading "All" tab is always kept; module tabs with no results are hidden.
  const visibleTabTitles = useMemo(() => {
    const sectionTitles = new Set(sections.map((section) => section.title));
    return tabTitles.filter(
      (title, index) => index === 0 || sectionTitles.has(title),
    );
  }, [sections, tabTitles]);

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
    searchStatus === ESearchStatus.done &&
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
    () => PRIMARY_SEARCH_TYPES.filter((type) => allowedSearchTypeSet.has(type)),
    [allowedSearchTypeSet],
  );
  const effectiveDeferredTypes = useMemo(
    () =>
      getSearchTypes().filter(
        (type) =>
          !PRIMARY_SEARCH_TYPES.includes(type) &&
          allowedSearchTypeSet.has(type),
      ),
    [allowedSearchTypeSet],
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
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.Address),
          type: EUniversalSearchType.Address,
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_wallets,
          }),
          ...buildSectionData(data),
        });
      }

      if (result?.[EUniversalSearchType.V2MarketToken]?.items?.length) {
        const data = result[EUniversalSearchType.V2MarketToken]
          .items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(
            EUniversalSearchType.V2MarketToken,
          ),
          type: EUniversalSearchType.V2MarketToken,
          title: intl.formatMessage({
            id: ETranslations.global_market,
          }),
          data,
          sliceData: data.slice(0, MARKET_SLICE_LIMIT),
          showMore: data.length > MARKET_SLICE_LIMIT,
        });
      }

      if (result?.[EUniversalSearchType.Perp]?.items?.length) {
        const data = result[EUniversalSearchType.Perp]
          .items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.Perp),
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
          tabIndex: getTabIndexForSearchType(
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
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.Dapp),
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
            tabIndex: getTabIndexForSearchType(EUniversalSearchType.Settings),
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
        searchText: input,
        resultCount,
        exposedTypes,
      });
    },
    [],
  );

  const isSearchResultStale = useCallback((input: string) => {
    return searchInputRef.current !== input;
  }, []);

  const handleTextChange = useDebouncedCallback(async (val: string) => {
    console.log('[universalSearch] handleTextChange: ', val);
    const input = val?.trim?.() || '';
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
          if (isSearchResultStale(input)) {
            return;
          }

          primarySections = buildSearchResultSections({
            result: primaryResult,
            input,
          });

          if (primarySections.length > 0) {
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
          if (isSearchResultStale(input)) {
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
        logSearchAnalytics(input, mergedSections);
      } catch (error) {
        if (isSearchResultStale(input)) {
          return;
        }
        console.error('[universalSearch] search failed', error);
        if (primarySections.length > 0) {
          setSections(primarySections);
          setSearchStatus(ESearchStatus.done);
          logSearchAnalytics(input, primarySections);
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

  const renderSectionFooter = useCallback(
    ({ section }: { section: IUniversalSection }) => {
      if (!isInAllTab) {
        return null;
      }
      if (section.showMore) {
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
    ({
      item,
      section,
      index,
    }: {
      item: IUniversalSearchResultItem;
      section: IUniversalSection;
      index: number;
    }) => {
      switch (item.type) {
        case EUniversalSearchType.Address:
          return (
            <UniversalSearchAddressItem
              item={item}
              contextNetworkId={activeAccount?.network?.id}
              getSearchInput={getSearchInput}
            />
          );
        case EUniversalSearchType.V2MarketToken:
          return (
            <>
              {index === 0 &&
              isMarketSection(section.tabIndex) &&
              searchStatus !== ESearchStatus.init ? (
                <MarketTableHeader />
              ) : null}
              <UniversalSearchV2MarketTokenItem
                item={item}
                isTrending={searchStatus === ESearchStatus.init}
                getSearchInput={getSearchInput}
              />
            </>
          );
        case EUniversalSearchType.AccountAssets:
          return (
            <UniversalSearchAccountAssetItem
              item={item}
              allAggregateTokenMap={allAggregateTokenMap}
              getSearchInput={getSearchInput}
            />
          );
        case EUniversalSearchType.Dapp:
          return (
            <UniversalSearchDappItem
              item={item}
              getSearchInput={getSearchInput}
            />
          );
        case EUniversalSearchType.Perp:
          return (
            <UniversalSearchPerpItem
              item={item}
              getSearchInput={getSearchInput}
            />
          );
        case EUniversalSearchType.Settings:
          return (
            <UniversalSearchSettingsItem
              item={item}
              getSearchInput={getSearchInput}
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
        case EUniversalSearchType.V2MarketToken:
          return `${type}-${payload.address ?? payload.symbol}-${index}`;
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

  const filterSections = useMemo(() => {
    if (isInAllTab) {
      const sectionsWithSliceData = sections.map((i) => ({
        ...i,
        data: i.sliceData,
      }));

      // When focused in Market tab, prioritize market section
      if (isFocusInMarketTab) {
        const marketSection = sectionsWithSliceData.find(
          (section) => section.tabIndex === MARKET_TAB_INDEX,
        );
        const prioritizedSecondarySection = sectionsWithSliceData.find(
          (section) => section.tabIndex === PRIORITIZED_SECONDARY_TAB_INDEX,
        );
        const otherSections = sectionsWithSliceData.filter(
          (section) =>
            section.tabIndex !== MARKET_TAB_INDEX &&
            section.tabIndex !== PRIORITIZED_SECONDARY_TAB_INDEX,
        );

        return marketSection
          ? [
              marketSection,
              prioritizedSecondarySection,
              ...otherSections,
            ].filter(Boolean)
          : sectionsWithSliceData;
      }

      return sectionsWithSliceData;
    }
    const filtered = sections.filter((i) => i.title === activeTab);
    return filtered;
  }, [activeTab, isInAllTab, sections, isFocusInMarketTab]);

  const renderResult = useCallback(() => {
    switch (searchStatus) {
      case ESearchStatus.init:
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
        return (
          <YStack px="$5" pt="$5">
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </YStack>
        );

      case ESearchStatus.done:
        return (
          <>
            {visibleTabTitles.length > 1 ? (
              <Tabs.TabBar
                scrollable
                tabNames={visibleTabTitles}
                onTabPress={handleTabPress}
                focusedTab={focusedTab}
                tabItemStyle={{
                  h: 44,
                }}
              />
            ) : null}
            <SectionList
              key={`search-results-${isInAllTab ? 'all' : activeTab}`}
              stickySectionHeadersEnabled
              sections={filterSections}
              renderSectionHeader={renderSectionHeader}
              renderSectionFooter={renderSectionFooter}
              ListEmptyComponent={
                <Empty
                  illustration="QuestionMark"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_results,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.global_search_no_results_desc,
                  })}
                />
              }
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              estimatedItemSize="$16"
              ListFooterComponent={<Stack h="$16" />}
              keyboardShouldPersistTaps="handled"
            />
          </>
        );
      default:
        break;
    }
  }, [
    searchStatus,
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
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_search })}
      />
      <Page.Body>
        <View px="$5" pb="$2">
          <SearchBar
            autoFocus
            testID={UniversalSearchTestIDs.searchBar}
            value={searchValue}
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
}: IPageScreenProps<
  IUniversalSearchParamList,
  EUniversalSearchPages.UniversalSearch
>) => {
  const { activeAccount } = useActiveAccount({ num: 0 });

  // Stabilize the fallback reference: getDefaultFilterTypes() returns a fresh
  // array, so computing it inline in the prop would rebuild the downstream
  // allowedSearchTypeSet memo (and its dependents) on every wrapper re-render.
  const routeFilterTypes = route?.params?.filterTypes;
  const filterTypes = useMemo(
    () => routeFilterTypes || getDefaultFilterTypes(),
    [routeFilterTypes],
  );

  return (
    <HomeTokenListProviderMirrorWrapper
      accountId={activeAccount?.account?.id ?? ''}
    >
      <UniversalSearch
        filterTypes={filterTypes}
        initialTab={route?.params?.initialTab}
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
