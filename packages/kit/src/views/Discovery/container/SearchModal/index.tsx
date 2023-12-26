import { useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  IconButton,
  ListItem,
  ListView,
  Page,
  ScrollView,
  Skeleton,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useBrowserBookmarkAction,
  useBrowserHistoryAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { useOpenWebsite } from '../../hooks/useOpenWebsite';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

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

  const { handleOpenWebSite } = useOpenWebsite({ useCurrentWindow, tabId });

  const { result: bookmarkData } = usePromiseResult(async () => {
    const bookmarks = await getBookmarkData();
    const slicedBookmarks = bookmarks.slice(0, 8);
    return Promise.all(
      slicedBookmarks.map(async (i) => ({
        ...i,
        logo: await backgroundApiProxy.serviceDiscovery.getWebsiteIcon(i.url),
      })),
    );
  }, [getBookmarkData]);

  const { result: historyData } = usePromiseResult(async () => {
    const histories = await getHistoryData();
    const slicedHistory = histories.slice(0, 8);
    return Promise.all(
      slicedHistory.map(async (i) => ({
        ...i,
        logo: await backgroundApiProxy.serviceDiscovery.getWebsiteIcon(i.url),
      })),
    );
  }, [getHistoryData]);

  const { result: searchResult } = usePromiseResult(async () => {
    const ret = await backgroundApiProxy.serviceDiscovery.searchDApp(
      searchValue,
    );
    return ret;
  }, [searchValue]);

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
  const displayBookmarkList = (bookmarkData ?? []).length > 0;
  const displayHistoryList = (historyData ?? []).length > 0;

  return (
    <Page skipLoading safeAreaEnabled>
      <Page.Header
        headerTitle="Search Modal"
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
              webSite: {
                url: searchValue,
                title: searchValue,
              },
            });
          },
        }}
      />
      <Page.Body>
        <ScrollView>
          {displaySearchList && (
            <ListView
              estimatedItemSize="$10"
              data={searchList}
              keyExtractor={(item) => item.dappId}
              renderItem={({ item }) => (
                <ListItem
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
                        webSite: {
                          url: searchValue,
                          title: searchValue,
                        },
                      });
                    } else {
                      handleOpenWebSite({
                        dApp: item,
                      });
                    }
                  }}
                />
              )}
            />
          )}
          {displayBookmarkList && (
            <>
              <XStack
                px="$4"
                py="$3"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text variant="$headingSm">Bookmarks</Text>
                <IconButton
                  size="small"
                  icon="DotHorOutline"
                  variant="tertiary"
                  focusStyle={undefined}
                  p="$0.5"
                  m={-3}
                  onPress={() => {
                    navigation.pushModal(EModalRoutes.DiscoveryModal, {
                      screen: EDiscoveryModalRoutes.BookmarkListModal,
                    });
                  }}
                />
              </XStack>
              <ListView
                estimatedItemSize="$10"
                horizontal
                data={bookmarkData}
                keyExtractor={(item) => item.url}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <YStack
                    maxWidth="$20"
                    alignItems="center"
                    justifyContent="center"
                    p="$4"
                    onPress={() => {
                      handleOpenWebSite({
                        webSite: {
                          url: item.url,
                          title: item.title,
                        },
                      });
                    }}
                  >
                    <ListItem.Avatar.Component
                      src={item.logo}
                      fallbackProps={{
                        children: <Skeleton w="$10" h="$10" />,
                      }}
                      circular
                    />
                    <Text
                      flex={1}
                      minHeight="$8"
                      numberOfLines={1}
                      mt="$2"
                      color="$text"
                      variant="$bodyMd"
                    >
                      {item.title}
                    </Text>
                  </YStack>
                )}
              />
            </>
          )}
          {displayHistoryList && (
            <>
              <XStack
                px="$4"
                py="$3"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text variant="$headingSm">Recents</Text>
                <IconButton
                  size="small"
                  icon="DotHorOutline"
                  variant="tertiary"
                  focusStyle={undefined}
                  p="$0.5"
                  m={-3}
                  onPress={() => {
                    navigation.pushModal(EModalRoutes.DiscoveryModal, {
                      screen: EDiscoveryModalRoutes.HistoryListModal,
                    });
                  }}
                />
              </XStack>
              <ListView
                height="100%"
                estimatedItemSize="$10"
                data={historyData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ListItem
                    avatarProps={{
                      src: item.logo,
                      fallbackProps: {
                        children: <Skeleton w="$10" h="$10" />,
                      },
                    }}
                    title={item.title}
                    subtitleProps={{
                      numberOfLines: 1,
                    }}
                    testID={`search-modal-${item.title.toLowerCase()}`}
                    onPress={() => {
                      handleOpenWebSite({
                        webSite: {
                          url: item.url,
                          title: item.title,
                        },
                      });
                    }}
                  />
                )}
              />
            </>
          )}
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(SearchModal);
