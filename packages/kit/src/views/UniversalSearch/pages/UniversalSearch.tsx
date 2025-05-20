import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Empty,
  NumberSizeableText,
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
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  EUniversalSearchPages,
  IUniversalSearchParamList,
} from '@onekeyhq/shared/src/routes/universalSearch';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import NumberSizeableTextWrapper from '../../../components/NumberSizeableTextWrapper';
import { Token, TokenName } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';
import { urlAccountNavigation } from '../../Home/pages/urlAccount/urlAccountUtils';
import { MarketStar } from '../../Market/components/MarketStar';
import { MarketTokenIcon } from '../../Market/components/MarketTokenIcon';
import { MarketTokenPrice } from '../../Market/components/MarketTokenPrice';
import { MarketWatchListProviderMirror } from '../../Market/MarketWatchListProviderMirror';

import { RecentSearched } from './components/RecentSearched';
import { UniversalSearchProviderMirror } from './UniversalSearchProviderMirror';

interface IUniversalSection {
  title: string;
  data: IUniversalSearchResultItem[];
}

enum ESearchStatus {
  init = 'init',
  loading = 'loading',
  done = 'done',
}

const AllTypes = [
  EUniversalSearchType.Address,
  EUniversalSearchType.MarketToken,
  EUniversalSearchType.AccountAssets,
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
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
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

  const handleTextChange = useDebouncedCallback(async (val: string) => {
    const input = val?.trim?.() || '';
    if (input) {
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
      const searchResultSections: {
        title: string;
        data: IUniversalSearchResultItem[];
      }[] = [];
      if (result?.[EUniversalSearchType.Address]?.items?.length) {
        searchResultSections.push({
          title: intl.formatMessage({
            id: ETranslations.global_wallets,
          }),
          data: result?.[EUniversalSearchType.Address]
            ?.items as IUniversalSearchResultItem[],
        });
      }

      if (result?.[EUniversalSearchType.MarketToken]?.items?.length) {
        searchResultSections.push({
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_tokens,
          }),
          data: result?.[EUniversalSearchType.MarketToken]
            ?.items as IUniversalSearchResultItem[],
        });
      }

      if (result?.[EUniversalSearchType.AccountAssets]?.items?.length) {
        searchResultSections.push({
          title: intl.formatMessage({
            id: ETranslations.global_universal_search_tabs_my_assets,
          }),
          data: result?.[EUniversalSearchType.AccountAssets]
            ?.items as IUniversalSearchResultItem[],
        });
      }

      setSections(searchResultSections);
      setSearchStatus(ESearchStatus.done);
    } else {
      setSearchStatus(ESearchStatus.init);
    }
  }, 1200);

  const handleChangeText = useCallback(() => {
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

  const renderItem = useCallback(
    ({ item }: { item: IUniversalSearchResultItem }) => {
      switch (item.type) {
        case EUniversalSearchType.Address: {
          const searchAddressItem = item;
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
        case EUniversalSearchType.MarketToken: {
          const { image, coingeckoId, price, symbol, name, lastUpdated } =
            item.payload;
          return (
            <ListItem
              jc="space-between"
              onPress={async () => {
                navigation.pop();
                setTimeout(async () => {
                  navigation.switchTab(ETabRoutes.Market);
                  navigation.push(ETabMarketRoutes.MarketDetail, {
                    token: coingeckoId,
                  });
                  defaultLogger.market.token.searchToken({
                    tokenSymbol: coingeckoId,
                    from:
                      searchStatus === ESearchStatus.init
                        ? 'trendingList'
                        : 'searchList',
                  });
                  setTimeout(() => {
                    universalSearchActions.current.addIntoRecentSearchList({
                      id: coingeckoId,
                      text: symbol,
                      type: item.type,
                      timestamp: Date.now(),
                    });
                  }, 10);
                }, 80);
              }}
              renderAvatar={<MarketTokenIcon uri={image} size="lg" />}
              title={symbol.toUpperCase()}
              subtitle={name}
              subtitleProps={{
                numberOfLines: 1,
              }}
            >
              <XStack>
                <MarketTokenPrice
                  price={String(price)}
                  size="$bodyLgMedium"
                  lastUpdated={lastUpdated}
                  tokenName={name}
                  tokenSymbol={symbol}
                />
                <MarketStar
                  coingeckoId={coingeckoId}
                  ml="$3"
                  from={EWatchlistFrom.search}
                />
              </XStack>
            </ListItem>
          );
        }
        case EUniversalSearchType.AccountAssets: {
          const { token, tokenFiat } = item.payload;
          const priceChange = tokenFiat?.price24h ?? 0;
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange,
          });
          const fiatValue = new BigNumber(tokenFiat?.fiatValue ?? 0);
          return (
            <ListItem
              key={token?.$key || token?.name}
              userSelect="none"
              onPress={() => {
                navigation.pop();
                setTimeout(async () => {
                  if (
                    !activeAccount ||
                    !activeAccount.account ||
                    !activeAccount.network ||
                    !activeAccount.wallet ||
                    !activeAccount.deriveInfo ||
                    !activeAccount.deriveType ||
                    !activeAccount.indexedAccount
                  )
                    return;

                  navigation.pushModal(EModalRoutes.MainModal, {
                    screen: EModalAssetDetailRoutes.TokenDetails,
                    params: {
                      accountId:
                        token.accountId ?? activeAccount.account?.id ?? '',
                      networkId: token.networkId ?? activeAccount.network?.id,
                      walletId: activeAccount.wallet?.id,
                      deriveInfo: activeAccount.deriveInfo,
                      deriveType: activeAccount.deriveType,
                      tokenInfo: token,
                      isAllNetworks: activeAccount.network?.isAllNetworks,
                      indexedAccountId: activeAccount.indexedAccount?.id ?? '',
                    },
                  });
                }, 80);
              }}
            >
              <Token
                size="lg"
                tokenImageUri={token?.logoURI}
                networkId={token?.networkId}
                showNetworkIcon
              />
              <Stack
                flexGrow={1}
                flexBasis={0}
                minWidth={96}
                flexDirection="column"
              >
                <TokenName
                  name={token?.name}
                  networkId={token?.networkId}
                  isNative={token?.isNative}
                  isAllNetworks={networkUtils.isAllNetwork({
                    networkId: activeAccount?.network?.id,
                  })}
                  withNetwork={networkUtils.isAllNetwork({
                    networkId: activeAccount?.network?.id,
                  })}
                  textProps={{
                    size: '$bodyLgMedium',
                    flexShrink: 0,
                  }}
                />
                <NumberSizeableTextWrapper
                  formatter="balance"
                  formatterOptions={{ tokenSymbol: token?.symbol }}
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  {tokenFiat?.balanceParsed ?? '0'}
                </NumberSizeableTextWrapper>
              </Stack>
              <Stack
                flexDirection="column"
                alignItems="flex-end"
                flexShrink={1}
              >
                <NumberSizeableTextWrapper
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                  size="$bodyLgMedium"
                >
                  {fiatValue.isNaN() ? 0 : fiatValue.toFixed()}
                </NumberSizeableTextWrapper>
                <NumberSizeableText
                  formatter="priceChange"
                  formatterOptions={{ showPlusMinusSigns }}
                  color={changeColor}
                  size="$bodyMd"
                >
                  {priceChange}
                </NumberSizeableText>
              </Stack>
            </ListItem>
          );
        }
        default: {
          return null;
        }
      }
    },
    [
      navigation,
      activeAccount,
      universalSearchActions,
      searchStatus,
      settings.currencyInfo.symbol,
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
      return sections;
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
      <UniversalSearchProviderMirror
        storeName={EJotaiContextStoreNames.universalSearch}
      >
        <UniversalSearchWithHomeTokenListProvider {...params} />
      </UniversalSearchProviderMirror>
    </MarketWatchListProviderMirror>
  </AccountSelectorProviderMirror>
);

export default UniversalSearchWithProvider;
