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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EUniversalSearchPages,
  IUniversalSearchParamList,
} from '@onekeyhq/shared/src/routes/universalSearch';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';
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
import {
  useAggregateTokensListMapAtom,
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';
import { MarketWatchListProviderMirror } from '../../Market/MarketWatchListProviderMirror';
import { MarketWatchListProviderMirrorV2 } from '../../Market/MarketWatchListProviderMirrorV2';
import { MarketTableHeader } from '../components/MarketTableHeader';
import {
  UniversalSearchAccountAssetItem,
  UniversalSearchAddressItem,
  UniversalSearchDappItem,
  UniversalSearchMarketTokenItem,
  UniversalSearchPerpItem,
  UniversalSearchSettingsItem,
  UniversalSearchV2MarketTokenItem,
} from '../components/SearchResultItems';
import { useSettingsSearch } from '../hooks/useSettingsSearch';

import { RecentSearched } from './components/RecentSearched';
import { UniversalSearchProviderMirror } from './UniversalSearchProviderMirror';

interface IUniversalSection {
  tabIndex: number;
  title: string;
  data: IUniversalSearchResultItem[];
  sliceData?: IUniversalSearchResultItem[];
  showMore?: boolean;
}

const getSearchTypes = () => {
  return [
    !platformEnv.isWebDappMode && EUniversalSearchType.Address,
    EUniversalSearchType.MarketToken,
    EUniversalSearchType.V2MarketToken,
    // Hide AccountAssets search in WebDapp mode
    !platformEnv.isWebDappMode && EUniversalSearchType.AccountAssets,
    !platformEnv.isWebDappMode && EUniversalSearchType.Dapp,
    EUniversalSearchType.Perp,
  ].filter(Boolean);
};

const getTabIndexForSearchType = (searchType: EUniversalSearchType): number => {
  const tabMapping: Record<EUniversalSearchType, number> = {
    [EUniversalSearchType.Address]: 1, // Wallets tab
    [EUniversalSearchType.V2MarketToken]: 2, // Market tab
    [EUniversalSearchType.Perp]: 3, // Perp tab (after Market)
    [EUniversalSearchType.MarketToken]: 4, // Tokens tab
    // In WebDapp mode, My Assets tab is hidden
    [EUniversalSearchType.AccountAssets]: platformEnv.isWebDappMode ? 0 : 5,
    // DApps tab index changes based on whether My Assets tab is shown
    [EUniversalSearchType.Dapp]: platformEnv.isWebDappMode ? 5 : 6,
    // Settings tab is last
    [EUniversalSearchType.Settings]: platformEnv.isWebDappMode ? 6 : 7,
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
  const [allTokenList] = useAllTokenListAtom();
  const [allTokenListMap] = useAllTokenListMapAtom();
  const [aggregateTokenListMap] = useAggregateTokensListMapAtom();

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
      intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
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
  const isInAllTab = useMemo(() => {
    return filterType === tabTitles[0];
  }, [filterType, tabTitles]);

  useEffect(() => {
    if (searchStatus === ESearchStatus.done) {
      const targetTabName = initialTabName;
      if (focusedTab.value !== targetTabName) {
        setFilterType(targetTabName);
        setTimeout(() => {
          focusedTab.value = targetTabName;
        }, 0);
      }
    }
  }, [focusedTab, searchStatus, initialTabName]);

  const shouldUseTokensCacheData = useMemo(() => {
    return (
      allTokenList &&
      allTokenListMap &&
      aggregateTokenListMap &&
      allTokenList.accountId === activeAccount?.account?.id &&
      allTokenList.networkId === activeAccount?.network?.id
    );
  }, [
    allTokenList,
    allTokenListMap,
    aggregateTokenListMap,
    activeAccount?.account?.id,
    activeAccount?.network?.id,
  ]);

  const fetchRecommendList = useCallback(async () => {
    const searchResultSections: IUniversalSection[] = [];

    const result =
      await backgroundApiProxy.serviceUniversalSearch.universalSearchRecommend({
        searchTypes: [EUniversalSearchType.MarketToken],
      });

    // Prefer V2MarketToken (has network badge from searchRecommendTokens)
    if (result?.[EUniversalSearchType.V2MarketToken]?.items?.length) {
      searchResultSections.push({
        tabIndex: 2,
        title: intl.formatMessage({ id: ETranslations.market_trending }),
        data: result[EUniversalSearchType.V2MarketToken]
          .items as IUniversalSearchResultItem[],
      });
    } else if (result?.[EUniversalSearchType.MarketToken]?.items) {
      // Fallback: convert MarketToken (coingecko-based, no network) to V2MarketToken
      const v2Items = result[EUniversalSearchType.MarketToken].items.map(
        (item) => {
          const token = item.payload;
          return {
            type: EUniversalSearchType.V2MarketToken,
            payload: {
              name: token.name,
              symbol: token.symbol,
              price: String(token.price),
              address: token.coingeckoId,
              network: '',
              logoUrl: token.image,
              isNative: false,
              decimals: 0,
              liquidity: '0',
              volume_24h: String(token.totalVolume || 0),
              marketCap: String(token.marketCap || 0),
              priceChange24hPercent: String(
                token.priceChangePercentage24H || 0,
              ),
            },
          };
        },
      );
      searchResultSections.push({
        tabIndex: 2,
        title: intl.formatMessage({ id: ETranslations.market_trending }),
        data: v2Items as IUniversalSearchResultItem[],
      });
    }
    setRecommendSections(searchResultSections);
  }, [intl]);

  useEffect(() => {
    void fetchRecommendList();
  }, [fetchRecommendList]);

  const searchInputRef = useRef<string>('');

  const handleTextChange = useDebouncedCallback(async (val: string) => {
    console.log('[universalSearch] handleTextChange: ', val);
    const input = val?.trim?.() || '';
    if (input) {
      searchInputRef.current = input;
      const result =
        await backgroundApiProxy.serviceUniversalSearch.universalSearch({
          input,
          networkId: activeAccount?.network?.id,
          accountId: activeAccount?.account?.id,
          indexedAccountId: activeAccount?.indexedAccount?.id,
          searchTypes: getSearchTypes(),
          tokenListCache: shouldUseTokensCacheData
            ? allTokenList?.tokens
            : undefined,
          tokenListCacheMap: shouldUseTokensCacheData
            ? allTokenListMap
            : undefined,
          aggregateTokenListCacheMap: shouldUseTokensCacheData
            ? aggregateTokenListMap
            : undefined,
        });
      const generateDataFn = (data: IUniversalSearchResultItem[]) => {
        return {
          data,
          sliceData: data.slice(0, DEFAULT_SLICE_LIMIT),
          showMore: data.length > DEFAULT_SLICE_LIMIT,
        };
      };

      // Special function for dApp results to handle Google search item
      const generateDappDataFn = (data: IUniversalSearchResultItem[]) => {
        const googleSearchIndex = data.findIndex(
          (item) =>
            item.type === EUniversalSearchType.Dapp &&
            isGoogleSearchItem(item.payload?.dappId),
        );

        if (googleSearchIndex === -1) {
          // No Google search item, use normal logic
          return generateDataFn(data);
        }

        // Separate Google search item from other results
        const googleSearchItem = data[googleSearchIndex];
        const otherResults = data.filter(
          (_, index) => index !== googleSearchIndex,
        );

        // Take first N non-Google results + always include Google search item
        const slicedOtherResults = otherResults.slice(0, DEFAULT_SLICE_LIMIT);
        const sliceData = [...slicedOtherResults, googleSearchItem];

        return {
          data,
          sliceData,
          // Only count non-Google items for showMore
          showMore: otherResults.length > DEFAULT_SLICE_LIMIT,
        };
      };

      const searchResultSections: IUniversalSection[] = [];
      if (result?.[EUniversalSearchType.Address]?.items?.length) {
        const data = result?.[EUniversalSearchType.Address]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.Address),
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_wallets,
          }),
          ...generateDataFn(data),
        });
      }

      // Show V2 market tokens
      if (result?.[EUniversalSearchType.V2MarketToken]?.items?.length) {
        const data = result?.[EUniversalSearchType.V2MarketToken]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(
            EUniversalSearchType.V2MarketToken,
          ),
          title: intl.formatMessage({
            id: ETranslations.global_market,
          }),
          data,
          sliceData: data.slice(0, MARKET_SLICE_LIMIT),
          showMore: data.length > MARKET_SLICE_LIMIT,
        });
      }

      if (result?.[EUniversalSearchType.Perp]?.items?.length) {
        const data = result?.[EUniversalSearchType.Perp]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.Perp),
          title: intl.formatMessage({
            id: ETranslations.global_perp,
          }),
          ...generateDataFn(data),
        });
      }

      if (result?.[EUniversalSearchType.MarketToken]?.items?.length) {
        const data = result?.[EUniversalSearchType.MarketToken]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.MarketToken),
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_tokens,
          }),
          ...generateDataFn(data),
        });
      }

      if (result?.[EUniversalSearchType.AccountAssets]?.items?.length) {
        const data = result?.[EUniversalSearchType.AccountAssets]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(
            EUniversalSearchType.AccountAssets,
          ),
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_my_assets,
          }),
          ...generateDataFn(data),
        });
      }

      if (result?.[EUniversalSearchType.Dapp]?.items?.length) {
        const data = result?.[EUniversalSearchType.Dapp]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.Dapp),
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_dapps,
          }),
          ...generateDappDataFn(data),
        });
      }

      // Settings search runs locally (no backend needed), hidden on Web
      const settingsResults = platformEnv.isWeb ? [] : searchSettings(input);
      if (settingsResults.length > 0) {
        const data = settingsResults as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(EUniversalSearchType.Settings),
          title: intl.formatMessage({
            id: ETranslations.global_settings,
          }),
          ...generateDataFn(data),
        });
      }

      setSections(searchResultSections);
      setSearchStatus(ESearchStatus.done);

      // Track search event for analytics
      // Exclude Google search item from result count
      const resultCount = searchResultSections.reduce((sum, section) => {
        const count = section.data.filter(
          (item) =>
            !(
              item.type === EUniversalSearchType.Dapp &&
              isGoogleSearchItem(item.payload?.dappId)
            ),
        ).length;
        return sum + count;
      }, 0);
      defaultLogger.universalSearch.search.universalSearchQuery({
        searchText: input,
        resultCount,
      });
    } else {
      setSearchStatus(ESearchStatus.init);
    }
  }, 1200);

  const handleChangeText = useCallback((val: string) => {
    console.log('[universalSearch] handleChangeText');
    setSearchValue(val); // Update search value state immediately
    setSearchStatus(ESearchStatus.loading);
  }, []);

  const handleSearchTextFill = useCallback(
    (text: string) => {
      setSearchValue(text);
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
            />
          );
        case EUniversalSearchType.MarketToken:
          return (
            <UniversalSearchMarketTokenItem
              item={item}
              searchStatus={searchStatus}
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
              />
            </>
          );
        case EUniversalSearchType.AccountAssets:
          return (
            <UniversalSearchAccountAssetItem
              item={item}
              allAggregateTokenMap={allAggregateTokenMap}
            />
          );
        case EUniversalSearchType.Dapp:
          return (
            <UniversalSearchDappItem
              item={item}
              getSearchInput={() => searchInputRef.current}
            />
          );
        case EUniversalSearchType.Perp:
          return <UniversalSearchPerpItem item={item} />;
        case EUniversalSearchType.Settings:
          return <UniversalSearchSettingsItem item={item} />;
        default:
          return null;
      }
    },
    [activeAccount?.network?.id, searchStatus, allAggregateTokenMap],
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
        case EUniversalSearchType.MarketToken:
          return `${type}-${payload.coingeckoId ?? index}`;
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
    const filtered = sections.filter((i) => i.title === filterType);
    return filtered;
  }, [filterType, isInAllTab, sections, isFocusInMarketTab]);

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
            ListEmptyComponent={<ListEmptyComponent />}
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
            <Tabs.TabBar
              scrollable
              tabNames={tabTitles}
              onTabPress={handleTabPress}
              focusedTab={focusedTab}
              tabItemStyle={{
                h: 44,
              }}
            />
            <SectionList
              key={`search-results-${isInAllTab ? 'all' : filterType}`}
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
    tabTitles,
    handleTabPress,
    focusedTab,
    isInAllTab,
    filterType,
    filterSections,
    renderSectionFooter,
    intl,
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

  return (
    <HomeTokenListProviderMirrorWrapper
      accountId={activeAccount?.account?.id ?? ''}
    >
      <UniversalSearch
        filterTypes={route?.params?.filterTypes || getSearchTypes()}
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
