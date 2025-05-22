import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
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
  Tab,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { DiscoveryBrowserProviderMirror } from '@onekeyhq/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EUniversalSearchPages,
  IUniversalSearchParamList,
} from '@onekeyhq/shared/src/routes/universalSearch';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';
import {
  ESearchStatus,
  EUniversalSearchType,
} from '@onekeyhq/shared/types/search';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountAvatar } from '../../../components/AccountAvatar';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '../../../states/jotai/contexts/tokenList';
import { AccountAddress } from '../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/AccountAddress';
import { AccountValueWithSpotlight } from '../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/AccountValue';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';
import { urlAccountNavigation } from '../../Home/pages/urlAccount/urlAccountUtils';
import { MarketStar } from '../../Market/components/MarketStar';
import { MarketTokenIcon } from '../../Market/components/MarketTokenIcon';
import { MarketTokenPrice } from '../../Market/components/MarketTokenPrice';
import { MarketWatchListProviderMirror } from '../../Market/MarketWatchListProviderMirror';
import {
  UniversalSearchAccountAssetItem,
  UniversalSearchDappItem,
  UniversalSearchMarketTokenItem,
} from '../components/SearchResultItems';

import { RecentSearched } from './components/RecentSearched';
import { UniversalSearchProviderMirror } from './UniversalSearchProviderMirror';

interface IUniversalSection {
  title: string;
  data: IUniversalSearchResultItem[];
  sliceData?: IUniversalSearchResultItem[];
  showMore?: boolean;
}

const AllTypes = [
  EUniversalSearchType.Address,
  EUniversalSearchType.MarketToken,
  EUniversalSearchType.AccountAssets,
  EUniversalSearchType.Dapp,
];

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
  const navigation = useAppNavigation();
  const accountSelectorActions = useAccountSelectorActions();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [allTokenList] = useAllTokenListAtom();
  const [allTokenListMap] = useAllTokenListMapAtom();

  const universalSearchActions = useUniversalSearchActions();
  const [sections, setSections] = useState<IUniversalSection[]>([]);
  const [searchStatus, setSearchStatus] = useState<ESearchStatus>(
    ESearchStatus.init,
  );
  const [recommendSections, setRecommendSections] = useState<
    IUniversalSection[]
  >([]);

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
          searchTypes: AllTypes,
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
      const searchResultSections: {
        title: string;
        data: IUniversalSearchResultItem[];
        sliceData?: IUniversalSearchResultItem[];
        showMore?: boolean;
      }[] = [];
      if (result?.[EUniversalSearchType.Address]?.items?.length) {
        const data = result?.[EUniversalSearchType.Address]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
          title: intl.formatMessage({
            id: ETranslations.global_wallets,
          }),
          ...generateDataFn(data),
        });
      }

      if (result?.[EUniversalSearchType.MarketToken]?.items?.length) {
        const data = result?.[EUniversalSearchType.MarketToken]
          ?.items as IUniversalSearchResultItem[];
        searchResultSections.push({
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
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_dapps,
          }),
          ...generateDataFn(data),
        });
      }

      setSections(searchResultSections);
      setSearchStatus(ESearchStatus.done);
    } else {
      setSearchStatus(ESearchStatus.init);
    }
  }, 1200);

  const handleChangeText = useCallback(() => {
    console.log('[universalSearch] handleChangeText');
    setSearchStatus(ESearchStatus.loading);
  }, []);

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
      if (section.showMore) {
        return (
          <ListItem
            onPress={() => {
              console.log('[universalSearch] renderSectionFooter: ', section);
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
    [intl],
  );

  const renderItem = useCallback(
    ({ item }: { item: IUniversalSearchResultItem }) => {
      switch (item.type) {
        case EUniversalSearchType.Address: {
          const searchAddressItem = item;
          if (searchAddressItem.payload.account) {
            return (
              <ListItem
                onPress={async () => {
                  navigation.pop();
                  if (
                    accountUtils.isOthersAccount({
                      accountId: searchAddressItem.payload.account.id,
                    })
                  ) {
                    await accountSelectorActions.current.confirmAccountSelect({
                      num: 0,
                      indexedAccount: undefined,
                      othersWalletAccount: searchAddressItem.payload.account,
                      forceSelectToNetworkId:
                        searchAddressItem.payload.network.id,
                    });
                  } else {
                    await accountSelectorActions.current.confirmAccountSelect({
                      num: 0,
                      indexedAccount: searchAddressItem.payload.indexedAccount,
                      othersWalletAccount: undefined,
                      forceSelectToNetworkId:
                        searchAddressItem.payload.network.id,
                    });
                  }
                  console.log('press account', searchAddressItem.payload);
                  console.log('press action: ', accountSelectorActions);
                }}
                renderAvatar={
                  <AccountAvatar
                    size="$10"
                    borderRadius="$1"
                    wallet={searchAddressItem.payload.wallet}
                    account={searchAddressItem.payload.account}
                    indexedAccount={searchAddressItem.payload.indexedAccount}
                  />
                }
                title={searchAddressItem.payload.accountInfo?.formattedName}
                renderItemText={(textProps) => (
                  <ListItem.Text
                    {...textProps}
                    flex={1}
                    primary={
                      <SizableText size="$bodyLgMedium" numberOfLines={1}>
                        {searchAddressItem.payload.accountInfo?.formattedName}
                      </SizableText>
                    }
                    secondary={
                      <XStack alignItems="center">
                        {/* TODO: 只有 indexedAccount 或 otherAccount 才有余额 */}
                        <AccountValueWithSpotlight
                          isOthersUniversal={accountUtils.isOthersAccount({
                            accountId: searchAddressItem.payload.account.id,
                          })}
                          index={0}
                          accountValue={searchAddressItem.payload.accountsValue}
                          linkedAccountId={searchAddressItem.payload.account.id}
                          linkedNetworkId={searchAddressItem.payload.network.id}
                        />
                        <AccountAddress
                          num={0}
                          linkedNetworkId={searchAddressItem.payload.network.id}
                          address={
                            searchAddressItem.payload.addressInfo.displayAddress
                          }
                          isEmptyAddress={false}
                        />
                      </XStack>
                    }
                  />
                )}
                subtitle={searchAddressItem.payload.addressInfo.displayAddress}
              />
            );
          }
          return (
            <ListItem
              onPress={() => {
                navigation.pop();
                setTimeout(async () => {
                  const { network, addressInfo } = searchAddressItem.payload;
                  navigation.switchTab(ETabRoutes.Home);
                  await urlAccountNavigation.pushUrlAccountPage(navigation, {
                    address: addressInfo.displayAddress,
                    networkId: network.id,
                    contextNetworkId: activeAccount?.network?.id,
                  });
                  setTimeout(() => {
                    universalSearchActions.current.addIntoRecentSearchList({
                      id: `${addressInfo.displayAddress}-${network.id || ''}-${
                        activeAccount?.network?.id || ''
                      }`,
                      text: addressInfo.displayAddress,
                      type: item.type,
                      timestamp: Date.now(),
                      extra: {
                        displayAddress: addressInfo.displayAddress,
                        networkId: network.id,
                        contextNetworkId: activeAccount?.network?.id || '',
                      },
                    });
                  }, 10);
                }, 80);
              }}
              renderAvatar={
                <NetworkAvatar
                  networkId={searchAddressItem.payload.network.id}
                  size="$10"
                />
              }
              title={searchAddressItem.payload.network.shortname}
              subtitle={accountUtils.shortenAddress({
                address: searchAddressItem.payload.addressInfo.displayAddress,
              })}
            />
          );
        }
        case EUniversalSearchType.MarketToken:
          return (
            <UniversalSearchMarketTokenItem
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
    [
      activeAccount,
      accountSelectorActions,
      navigation,
      universalSearchActions,
      searchStatus,
    ],
  );

  const tabTitles = useMemo(() => {
    return [
      {
        title: intl.formatMessage({
          id: ETranslations.global_all,
        }),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_wallets,
        }),
      },

      {
        title: intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_tokens,
        }),
      },

      {
        title: intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_my_assets,
        }),
      },

      {
        title: intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_dapps,
        }),
      },
    ];
  }, [intl]);

  const [filterType, setFilterType] = useState(tabTitles[0].title);
  const handleTabSelectedPageIndex = useCallback(
    (index: number) => {
      setFilterType(tabTitles[index].title);
    },
    [tabTitles],
  );

  const filterSections = useMemo(() => {
    if (filterType === tabTitles[0].title) {
      return sections.map((i) => ({
        ...i,
        data: i.sliceData,
      }));
    }
    return sections.filter((i) => i.title === filterType);
  }, [filterType, sections, tabTitles]);

  const renderResult = useCallback(() => {
    switch (searchStatus) {
      case ESearchStatus.init:
        return (
          <SectionList
            renderSectionHeader={renderSectionHeader}
            sections={recommendSections}
            renderItem={renderItem}
            ListHeaderComponent={<RecentSearched filterTypes={filterTypes} />}
            ListEmptyComponent={<ListEmptyComponent />}
            estimatedItemSize="$16"
            ListFooterComponent={<Stack h="$16" />}
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
            <XStack
              borderColor="$borderSubdued"
              borderWidth={0}
              borderBottomWidth={StyleSheet.hairlineWidth}
              mb="$3"
            >
              <Tab.Header
                style={{
                  height: 44,
                  borderBottomWidth: 0,
                }}
                data={tabTitles}
                onSelectedPageIndex={handleTabSelectedPageIndex}
              />
            </XStack>
            <SectionList
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
            />
          </>
        );
      default:
        break;
    }
  }, [
    filterSections,
    filterTypes,
    handleTabSelectedPageIndex,
    intl,
    recommendSections,
    renderItem,
    renderSectionHeader,
    renderSectionFooter,
    searchStatus,
    tabTitles,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_search })}
      />
      <Page.Body>
        <View px="$5">
          <SearchBar
            autoFocus
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
      <UniversalSearch filterTypes={route?.params?.filterTypes || AllTypes} />
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
  </AccountSelectorProviderMirror>
);

export default UniversalSearchWithProvider;
