import { useCallback, useEffect, useState } from 'react';

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
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

export function UniversalSearch({
  searchType,
}: {
  searchType?: EUniversalSearchType;
}) {
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
        title: 'Trending',
        data: result?.[EUniversalSearchType.MarketToken]
          ?.items as IUniversalSearchResultItem[],
      });
    }
    setRecommendSections(searchResultSections);
  }, [searchType]);

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
      console.log('---searchResultSections', searchResultSections);
      setSearchStatus(ESearchStatus.done);
    } else {
      setSearchStatus(ESearchStatus.init);
    }
  }, 1200);

  const handleChangeText = useCallback(() => {
    setSearchStatus(ESearchStatus.loading);
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: IUniversalSection }) => (
      <SizableText px="$5" pb={0} size="$headingSm">
        {section.title}
      </SizableText>
    ),
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
                setTimeout(() => {
                  const { network, addressInfo } = searchAddressItem.payload;
                  urlAccountNavigation.pushUrlAccountPage(navigation, {
                    address: addressInfo.displayAddress,
                    networkId: network.id,
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
          const { image, coingeckoId, price, symbol, name } = item.payload;
          return (
            <ListItem
              jc="space-between"
              mx={0}
              pl="$5"
              pr={0}
              onPress={async () => {
                navigation.pop();
                setTimeout(async () => {
                  navigation.push(ETabMarketRoutes.MarketDetail, {
                    coinGeckoId: coingeckoId,
                    icon: image,
                    symbol,
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
              avatarProps={{
                src: decodeURIComponent(image),
                size: '$10',
              }}
              title={symbol.toUpperCase()}
              subtitle={name}
            >
              <XStack>
                <NumberSizeableText
                  size="$bodyLgMedium"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                >
                  {price}
                </NumberSizeableText>
                <MarketStar coingeckoId={coingeckoId} mx="$3" />
              </XStack>
            </ListItem>
          );
        }
        default: {
          return null;
        }
      }
    },
    [universalSearchActions, navigation],
  );

  const renderResult = useCallback(() => {
    switch (searchStatus) {
      case ESearchStatus.init:
        return (
          <>
            <RecentSearched searchType={searchType} />
            <SectionList
              renderSectionHeader={renderSectionHeader}
              sections={recommendSections}
              renderItem={renderItem}
              ListEmptyComponent={
                <YStack px="$5">
                  <SizableText numberOfLines={1} size="$headingSm">
                    Trending
                  </SizableText>
                  <SkeletonItem />
                  <SkeletonItem />
                  <SkeletonItem />
                </YStack>
              }
              estimatedItemSize="$16"
            />
          </>
        );

      case ESearchStatus.loading:
        return (
          <YStack px="$5">
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </YStack>
        );

      case ESearchStatus.done:
        return (
          <SectionList
            sections={sections}
            // renderSectionHeader={renderSectionHeader}
            ListEmptyComponent={
              <Empty
                icon="SearchOutline"
                title="No Results"
                description="Try to change the search keyword"
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
    recommendSections,
    renderItem,
    renderSectionHeader,
    searchStatus,
    searchType,
    sections,
  ]);

  return (
    <Page>
      <Page.Header title="Search" />
      <Page.Body>
        <View p="$5" pt={0}>
          <SearchBar
            autoFocus
            placeholder="Search"
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
