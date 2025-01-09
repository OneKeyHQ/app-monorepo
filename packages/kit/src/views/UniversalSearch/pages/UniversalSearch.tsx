import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Empty,
  Page,
  SearchBar,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EUniversalSearchPages,
  IUniversalSearchParamList,
} from '@onekeyhq/shared/src/routes/universalSearch';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
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

function ListEmptyComponent({
  searchType,
}: {
  searchType?: EUniversalSearchType;
}) {
  const intl = useIntl();
  switch (searchType) {
    case EUniversalSearchType.MarketToken: {
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
    default: {
      return null;
    }
  }
}

export function UniversalSearch({
  searchType,
}: {
  searchType?: EUniversalSearchType;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const universalSearchActions = useUniversalSearchActions();
  const [sections, setSections] = useState<IUniversalSection[]>([]);
  const [searchStatus, setSearchStatus] = useState<ESearchStatus>(
    ESearchStatus.init,
  );
  const [recommendSections, setRecommendSections] = useState<
    IUniversalSection[]
  >([]);

  const searchPlaceholderText = useMemo(
    () =>
      intl.formatMessage({
        id:
          searchType === EUniversalSearchType.MarketToken
            ? ETranslations.global_search_tokens
            : ETranslations.global_search,
      }),
    [intl, searchType],
  );

  const fetchRecommendList = useCallback(async () => {
    const searchResultSections: {
      title: string;
      data: IUniversalSearchResultItem[];
    }[] = [];
    const result =
      await backgroundApiProxy.serviceUniversalSearch.universalSearchRecommend({
        searchTypes: searchType ? [searchType] : [],
      });
    if (result?.[EUniversalSearchType.MarketToken]?.items) {
      searchResultSections.push({
        title: intl.formatMessage({ id: ETranslations.market_trending }),
        data: result?.[EUniversalSearchType.MarketToken]
          ?.items as IUniversalSearchResultItem[],
      });
    }
    setRecommendSections(searchResultSections);
  }, [intl, searchType]);

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
          searchTypes: [searchType || EUniversalSearchType.Address],
        });
      const searchResultSections: {
        title: string;
        data: IUniversalSearchResultItem[];
      }[] = [];
      if (result?.[EUniversalSearchType.Address]?.items?.length) {
        searchResultSections.push({
          title: 'Wallet',
          data: result?.[EUniversalSearchType.Address]
            ?.items as IUniversalSearchResultItem[],
        });
      }

      if (result?.[EUniversalSearchType.MarketToken]?.items?.length) {
        searchResultSections.push({
          title: 'Market Token',
          data: result?.[EUniversalSearchType.MarketToken]
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
      if (searchType === EUniversalSearchType.MarketToken) {
        return (
          <SizableText px="$5" pb={0} size="$headingSm" color="$textSubdued">
            {section.title}
          </SizableText>
        );
      }
      return (
        <SizableText px="$5" pb={0} size="$headingSm">
          {section.title}
        </SizableText>
      );
    },
    [searchType],
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
                  await urlAccountNavigation.pushUrlAccountPage(navigation, {
                    address: addressInfo.displayAddress,
                    networkId: network.id,
                    contextNetworkId: activeAccount?.network?.id,
                  });
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
                      text: symbol.toUpperCase(),
                      type: item.type,
                      timestamp: Date.now(),
                    });
                  }, 10);
                }, 80);
              }}
              renderAvatar={<MarketTokenIcon uri={image} size="$10" />}
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
        default: {
          return null;
        }
      }
    },
    [
      navigation,
      activeAccount?.network?.id,
      searchStatus,
      universalSearchActions,
    ],
  );

  const renderResult = useCallback(() => {
    switch (searchStatus) {
      case ESearchStatus.init:
        return (
          <SectionList
            renderSectionHeader={renderSectionHeader}
            sections={recommendSections}
            renderItem={renderItem}
            ListHeaderComponent={<RecentSearched searchType={searchType} />}
            ListEmptyComponent={<ListEmptyComponent searchType={searchType} />}
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
          <SectionList
            mt="$5"
            sections={sections}
            // renderSectionHeader={renderSectionHeader}
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
        );
      default:
        break;
    }
  }, [
    intl,
    recommendSections,
    renderItem,
    renderSectionHeader,
    searchStatus,
    searchType,
    sections,
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
            placeholder={searchPlaceholderText}
            onSearchTextChange={handleTextChange}
            onChangeText={handleChangeText}
          />
        </View>
        {renderResult()}
      </Page.Body>
    </Page>
  );
}

const UniversalSearchWithProvider = ({
  route,
}: IPageScreenProps<
  IUniversalSearchParamList,
  EUniversalSearchPages.UniversalSearch
>) => (
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
        <UniversalSearch
          searchType={route?.params?.filterType || EUniversalSearchType.Address}
        />
      </UniversalSearchProviderMirror>
    </MarketWatchListProviderMirror>
  </AccountSelectorProviderMirror>
);

export default UniversalSearchWithProvider;
