import { useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';

import {
  Image,
  Page,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useBrowserAction,
  useBrowserBookmarkAction,
  useBrowserHistoryAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { EDiscoveryModalRoutes } from '../../router/Routes';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import { DappSearchModalSectionHeader } from './DappSearchModalSectionHeader';

import type { IDiscoveryModalParamList } from '../../router/Routes';
import type { RouteProp } from '@react-navigation/core';

const SEARCH_ITEM_ID = 'SEARCH_ITEM_ID';

function SearchModal() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IDiscoveryModalParamList, EDiscoveryModalRoutes.SearchModal>
    >();
  const { useCurrentWindow, tabId } = route.params ?? {};
  const [searchValue, setSearchValue] = useState('');
  const { getBookmarkData } = useBrowserBookmarkAction().current;
  const { getHistoryData } = useBrowserHistoryAction().current;
  const { handleOpenWebSite } = useBrowserAction().current;

  const { result: localData, run: refreshLocalData } =
    usePromiseResult(async () => {
      const bookmarks = await getBookmarkData();
      const slicedBookmarks = bookmarks.slice(0, 8);
      const bookmarkData = await Promise.all(
        slicedBookmarks.map(async (i) => ({
          ...i,
          logo: await backgroundApiProxy.serviceDiscovery.getWebsiteIcon(i.url),
        })),
      );
      const histories = await getHistoryData();
      const slicedHistory = histories.slice(0, 8);
      const historyData = await Promise.all(
        slicedHistory.map(async (i) => ({
          ...i,
          logo: await backgroundApiProxy.serviceDiscovery.getWebsiteIcon(i.url),
        })),
      );
      return {
        bookmarkData,
        historyData,
      };
    }, [getBookmarkData, getHistoryData]);

  const { result: searchResult } = usePromiseResult(async () => {
    const ret = await backgroundApiProxy.serviceDiscovery.searchDApp(
      searchValue,
    );
    return ret;
  }, [searchValue]);

  const jumpPageRef = useRef(false);
  useFocusEffect(() => {
    if (jumpPageRef.current) {
      setTimeout(() => {
        void refreshLocalData();
      }, 300);
      jumpPageRef.current = false;
    }
  });

  const [searchList, setSearchList] = useState<IDApp[]>([]);
  useEffect(() => {
    void (async () => {
      if (!searchValue) {
        setSearchList([]);
        return;
      }
      const logo = await backgroundApiProxy.serviceDiscovery.getWebsiteIcon(
        'https://google.com',
      );
      setSearchList([
        {
          dappId: SEARCH_ITEM_ID,
          // TODO: i18n
          name: `Search "${searchValue}"`,
          url: '',
          logo,
        } as IDApp,
        ...(searchResult ?? []),
      ]);
    })();
  }, [searchValue, searchResult]);

  const displaySearchList = Array.isArray(searchList) && searchList.length > 0;
  const displayBookmarkList =
    (localData?.bookmarkData ?? []).length > 0 && !displaySearchList;
  const displayHistoryList =
    (localData?.historyData ?? []).length > 0 && !displaySearchList;

  return (
    <Page skipLoading safeAreaEnabled scrollEnabled>
      <Page.Header
        headerTitle="Search"
        headerSearchBarOptions={{
          autoFocus: true,
          placeholder: 'Search',
          inputType: 'text',
          hideNavigationBar: true,
          hideWhenScrolling: false,
          onChangeText: ({ nativeEvent }) => {
            setSearchValue(nativeEvent.text);
          },
          onSearchButtonPress: () => {
            handleOpenWebSite({
              navigation,
              useCurrentWindow,
              tabId,
              webSite: {
                url: searchValue,
                title: searchValue,
              },
            });
          },
        }}
      />
      <Page.Body pt="$2" pb="$5">
        {displaySearchList && (
          <Stack pb="$5">
            {searchList.map((item, index) => (
              <ListItem
                key={index}
                avatarProps={{
                  src: item.logo || item.originLogo,
                  fallbackProps: {
                    children: <Skeleton w="$10" h="$10" />,
                  },
                }}
                title={item.name}
                subtitleProps={{
                  numberOfLines: 1,
                }}
                onPress={() => {
                  if (item.dappId === SEARCH_ITEM_ID) {
                    handleOpenWebSite({
                      navigation,
                      useCurrentWindow,
                      tabId,
                      webSite: {
                        url: searchValue,
                        title: searchValue,
                      },
                    });
                  } else {
                    handleOpenWebSite({
                      navigation,
                      useCurrentWindow,
                      tabId,
                      dApp: item,
                    });
                  }
                }}
              />
            ))}
          </Stack>
        )}

        {displayBookmarkList && (
          <Stack>
            <DappSearchModalSectionHeader
              title="Bookmarks"
              onMorePress={() => {
                jumpPageRef.current = true;
                navigation.pushModal(EModalRoutes.DiscoveryModal, {
                  screen: EDiscoveryModalRoutes.BookmarkListModal,
                });
              }}
            />
            <XStack>
              {localData?.bookmarkData?.map((item, index) => (
                <Stack
                  key={index}
                  flexBasis="25%"
                  alignItems="center"
                  py="$2"
                  $gtMd={{
                    flexBasis: '16.66666667%',
                  }}
                  onPress={() => {
                    handleOpenWebSite({
                      navigation,
                      useCurrentWindow,
                      tabId,
                      webSite: {
                        url: item.url,
                        title: item.title,
                      },
                    });
                  }}
                >
                  <Image w="$14" h="$14" borderRadius="$3">
                    <Image.Source
                      source={{
                        uri: item.logo,
                      }}
                    />
                  </Image>
                  <SizableText
                    mt="$2"
                    px="$2"
                    size="$bodyLgMedium"
                    textAlign="center"
                    $gtMd={{
                      size: '$bodyMdMedium',
                    }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </SizableText>
                </Stack>
              ))}
            </XStack>
          </Stack>
        )}
        {displayHistoryList && (
          <Stack pt="$5">
            <DappSearchModalSectionHeader
              title="History"
              onMorePress={() => {
                jumpPageRef.current = true;
                navigation.pushModal(EModalRoutes.DiscoveryModal, {
                  screen: EDiscoveryModalRoutes.HistoryListModal,
                });
              }}
            />
            {localData?.historyData?.map((item, index) => (
              <ListItem
                key={index}
                avatarProps={{
                  src: item.logo,
                }}
                title={item.title}
                subtitle={item.url}
                subtitleProps={{
                  numberOfLines: 1,
                }}
                testID={`search-modal-${item.title.toLowerCase()}`}
                onPress={() => {
                  handleOpenWebSite({
                    navigation,
                    useCurrentWindow,
                    tabId,
                    webSite: {
                      url: item.url,
                      title: item.title,
                    },
                  });
                }}
              />
            ))}
          </Stack>
        )}
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(SearchModal);
