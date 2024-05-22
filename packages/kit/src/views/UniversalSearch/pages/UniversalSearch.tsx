import { useCallback, useEffect, useRef, useState } from 'react';

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

import { RecentSearched } from './components/RecentSearched';
import { MarketStar } from '../../Market/components/MarketStar';

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
  <XStack px="$5" py="$2" alignItems="center">
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
    if (result?.[EUniversalSearchType.Address]?.items) {
      searchResultSections.push({
        title: 'Wallet',
        data: result?.[EUniversalSearchType.Address]
          ?.items as IUniversalSearchResultItem[],
      });
    }

    if (result?.[EUniversalSearchType.MarketToken]?.items) {
      searchResultSections.push({
        title: 'Market Token',
        data: result?.[EUniversalSearchType.MarketToken]
          ?.items as IUniversalSearchResultItem[],
      });
    }

    setSections(searchResultSections);
    setSearchStatus(ESearchStatus.done);
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
            <XStack
              jc="space-between"
              ai="center"
              onPress={async () => {
                navigation.pop();
                setTimeout(async () => {
                  navigation.push(ETabMarketRoutes.MarketDetail, {
                    coinGeckoId: coingeckoId,
                    icon: image,
                    symbol,
                  });
                  await backgroundApiProxy.serviceUniversalSearch.addIntoRecentSearch(
                    {
                      id: coingeckoId,
                      text: symbol.toUpperCase(),
                      type: item.type,
                      timestamp: Date.now(),
                    },
                  );
                }, 80);
              }}
            >
              <ListItem
                avatarProps={{
                  src: decodeURIComponent(image),
                  size: '$10',
                }}
                title={symbol.toUpperCase()}
                subtitle={name}
              />
              <XStack pr="$5" space="$5">
                <NumberSizeableText
                  size="$bodyLgMedium"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                >
                  {price}
                </NumberSizeableText>
                <MarketStar coingeckoId={coingeckoId} />
              </XStack>
            </XStack>
          );
        }
        default: {
          return null;
        }
      }
    },
    [navigation],
  );

  const renderResult = useCallback(() => {
    switch (searchStatus) {
      case ESearchStatus.init:
        return (
          <>
            <RecentSearched />
            <SectionList
              renderSectionHeader={renderSectionHeader}
              sections={recommendSections}
              renderItem={renderItem}
              estimatedItemSize="$16"
            />
          </>
        );

      case ESearchStatus.loading:
        return (
          <YStack>
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
              <Empty icon="SearchOutline" title="No Results" />
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

const UniversalSearchProvider = ({
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
    <UniversalSearch
      searchType={route?.params?.filterType || EUniversalSearchType.Address}
    />
  </AccountSelectorProviderMirror>
);

export default UniversalSearchProvider;
