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
import { useMarketV2Enabled } from '@onekeyhq/kit/src/hooks/useMarketV2Enabled';
import { DiscoveryBrowserProviderMirror } from '@onekeyhq/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isGoogleSearchItem } from '@onekeyhq/shared/src/consts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';
import { MarketWatchListProviderMirror } from '../../Market/MarketWatchListProviderMirror';
import { MarketWatchListProviderMirrorV2 } from '../../Market/MarketWatchListProviderMirrorV2';
import {
  UniversalSearchAccountAssetItem,
  UniversalSearchAddressItem,
  UniversalSearchDappItem,
  UniversalSearchMarketTokenItem,
  UniversalSearchV2MarketTokenItem,
} from '../components/SearchResultItems';

import { RecentSearched } from './components/RecentSearched';
import { UniversalSearchProviderMirror } from './UniversalSearchProviderMirror';

interface IUniversalSection {
  tabIndex: number;
  title: string;
  data: IUniversalSearchResultItem[];
  sliceData?: IUniversalSearchResultItem[];
  showMore?: boolean;
}

const getSearchTypes = (enableMarketV2: boolean) => [
  EUniversalSearchType.Address,
  EUniversalSearchType.MarketToken,
  ...(enableMarketV2 ? [EUniversalSearchType.V2MarketToken] : []),
  EUniversalSearchType.AccountAssets,
  EUniversalSearchType.Dapp,
];

const getTabIndexForSearchType = (
  searchType: EUniversalSearchType,
  enableMarketV2: boolean,
): number => {
  const baseTabMapping = {
    [EUniversalSearchType.Address]: 1, // Wallets tab
    [EUniversalSearchType.MarketToken]: enableMarketV2 ? 3 : 2, // Tokens tab (shifts when Market V2 exists)
    [EUniversalSearchType.V2MarketToken]: 2, // Market tab (only when V2 enabled)
    [EUniversalSearchType.AccountAssets]: enableMarketV2 ? 4 : 3, // My Assets tab
    [EUniversalSearchType.Dapp]: enableMarketV2 ? 5 : 4, // DApps tab
  };

  return baseTabMapping[searchType];
};

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

export function UniversalSearch({
  filterTypes,
}: {
  filterTypes?: EUniversalSearchType[];
}) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [allTokenList] = useAllTokenListAtom();
  const [allTokenListMap] = useAllTokenListMapAtom();
  const enableMarketV2 = useMarketV2Enabled();

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

  const tabTitles = useMemo(() => {
    return [
      intl.formatMessage({
        id: ETranslations.global_all,
      }),
      intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_wallets,
      }),
      enableMarketV2
        ? intl.formatMessage({
            id: ETranslations.global_market,
          })
        : null,
      intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      }),
      intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_my_assets,
      }),
      intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_dapps,
      }),
    ].filter(Boolean);
  }, [intl, enableMarketV2]);
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
    if (
      searchStatus === ESearchStatus.done &&
      focusedTab.value !== tabTitles[0]
    ) {
      const firstTabName = tabTitles[0];
      setFilterType(firstTabName);
      setTimeout(() => {
        focusedTab.value = firstTabName;
      }, 0);
    }
  }, [focusedTab, searchStatus, tabTitles]);

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
    const searchResultSections: {
      title: string;
      data: IUniversalSearchResultItem[];
    }[] = [];

    const result =
      await backgroundApiProxy.serviceUniversalSearch.universalSearchRecommend({
        searchTypes: [EUniversalSearchType.MarketToken],
      });
    if (result?.[EUniversalSearchType.MarketToken]?.items) {
      searchResultSections.push({
        title: intl.formatMessage({ id: ETranslations.market_trending }),
        data: result?.[EUniversalSearchType.MarketToken]
          ?.items as IUniversalSearchResultItem[],
      });
    }
    setRecommendSections(searchResultSections as IUniversalSection[]);
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
          searchTypes: getSearchTypes(enableMarketV2),
          tokenListCache: shouldUseTokensCacheData
            ? allTokenList?.tokens
            : undefined,
          tokenListCacheMap: shouldUseTokensCacheData
            ? allTokenListMap
            : undefined,
        });
      const generateDataFn = (data: IUniversalSearchResultItem[]) => {
        return {
          data,
          sliceData: data.slice(0, 5),
          showMore: data.length > 5,
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

        // Take first 5 non-Google results + always include Google search item
        const slicedOtherResults = otherResults.slice(0, 5);
        const sliceData = [...slicedOtherResults, googleSearchItem];

        return {
          data,
          sliceData,
          showMore: otherResults.length > 5, // Only count non-Google items for showMore
        };
      };

      const searchResultSections: IUniversalSection[] = [];
      if (result?.[EUniversalSearchType.Address]?.items?.length) {
        const data = result?.[EUniversalSearchType.Address]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(
            EUniversalSearchType.Address,
            enableMarketV2,
          ),
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_wallets,
          }),
          ...generateDataFn(data),
        });
      }

      // Show V2 market tokens only when V2 is enabled
      if (
        enableMarketV2 &&
        result?.[EUniversalSearchType.V2MarketToken]?.items?.length
      ) {
        const data = result?.[EUniversalSearchType.V2MarketToken]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(
            EUniversalSearchType.V2MarketToken,
            enableMarketV2,
          ),
          title: intl.formatMessage({
            id: ETranslations.global_market,
          }),
          ...generateDataFn(data),
        });
      }

      if (result?.[EUniversalSearchType.MarketToken]?.items?.length) {
        const data = result?.[EUniversalSearchType.MarketToken]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          tabIndex: getTabIndexForSearchType(
            EUniversalSearchType.MarketToken,
            enableMarketV2,
          ),
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
            enableMarketV2,
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
          tabIndex: getTabIndexForSearchType(
            EUniversalSearchType.Dapp,
            enableMarketV2,
          ),
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_dapps,
          }),
          ...generateDappDataFn(data),
        });
      }

      setSections(searchResultSections);
      setSearchStatus(ESearchStatus.done);
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
        <XStack bg="$bgApp" h="$9" ai="center">
          <SizableText px="$5" size="$headingSm" color="$textSubdued">
            {section.title}
          </SizableText>
        </XStack>
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
    ({ item }: { item: IUniversalSearchResultItem }) => {
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
            <UniversalSearchV2MarketTokenItem
              item={item}
              searchStatus={searchStatus}
            />
          );
        case EUniversalSearchType.AccountAssets:
          return <UniversalSearchAccountAssetItem item={item} />;
        case EUniversalSearchType.Dapp:
          return (
            <UniversalSearchDappItem
              item={item}
              getSearchInput={() => searchInputRef.current}
            />
          );
        default:
          return null;
      }
    },
    [activeAccount?.network?.id, searchStatus],
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
          (section) => section.tabIndex === 2, // market tab index
        );
        const tokenSection = sectionsWithSliceData.find(
          (section) => section.tabIndex === 3,
        );
        const otherSections = sectionsWithSliceData.filter(
          (section) => section.tabIndex !== 2 && section.tabIndex !== 3,
        );

        return marketSection
          ? [marketSection, tokenSection, ...otherSections].filter(Boolean)
          : sectionsWithSliceData;
      }

      return sectionsWithSliceData;
    }
    return sections.filter((i) => i.title === filterType);
  }, [filterType, isInAllTab, sections, isFocusInMarketTab]);

  const renderResult = useCallback(() => {
    switch (searchStatus) {
      case ESearchStatus.init:
        return (
          <SectionList
            renderSectionHeader={renderSectionHeader}
            sections={recommendSections}
            renderItem={renderItem}
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
                  icon="SearchOutline"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_results,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.global_search_no_results_desc,
                  })}
                />
              }
              renderItem={renderItem}
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
    recommendSections,
    renderItem,
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
              id: ETranslations.global_universal_search_placeholder,
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
  const enableMarketV2 = useMarketV2Enabled();

  return (
    <HomeTokenListProviderMirrorWrapper
      accountId={activeAccount?.account?.id ?? ''}
    >
      <UniversalSearch
        filterTypes={
          route?.params?.filterTypes || getSearchTypes(enableMarketV2)
        }
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
