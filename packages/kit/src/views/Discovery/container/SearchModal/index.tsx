import { useCallback, useMemo, useState } from 'react';

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
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import {
  useBrowserAction,
  useBrowserBookmarkAction,
  useBrowserHistoryAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { getUrlIcon } from '../../utils/explorerUtils';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IMatchDAppItemType } from '../../types';

const SEARCH_ITEM_ID = 'SEARCH_ITEM_ID';

function SearchModal() {
  const navigation = useAppNavigation();
  const [searchValue, setSearchValue] = useState('');
  const { setDisplayHomePage } = useBrowserTabActions().current;
  const { openMatchDApp } = useBrowserAction().current;
  const { getBookmarkData } = useBrowserBookmarkAction().current;
  const { getHistoryData } = useBrowserHistoryAction().current;

  const handleOpenWebSite = useCallback(
    ({ dApp, webSite }: IMatchDAppItemType) => {
      setDisplayHomePage(false);

      void openMatchDApp({
        webSite,
        dApp,
        isNewWindow: true,
      });
      if (platformEnv.isDesktop) {
        navigation.switchTab(ETabRoutes.MultiTabBrowser);
      } else {
        navigation.pop();
      }
    },
    [setDisplayHomePage, navigation, openMatchDApp],
  );

  const { result: bookmarkData } = usePromiseResult(async () => {
    const bookmarks = await getBookmarkData();
    return bookmarks.slice(0, 8);
  }, [getBookmarkData]);

  const { result: historyData } = usePromiseResult(async () => {
    const histories = await getHistoryData();
    return histories.slice(0, 8);
  }, [getHistoryData]);

  const { result: searchResult } = usePromiseResult(async () => {
    const ret = await backgroundApiProxy.serviceDiscovery.searchDApp(
      searchValue,
    );
    return ret;
  }, [searchValue]);

  const searchList = useMemo<IDApp[]>(() => {
    if (!searchValue) {
      return [];
    }
    return [
      {
        _id: SEARCH_ITEM_ID,
        dappradarId: '',
        name: `Search "${searchValue}"`,
        url: '',
        logo: getUrlIcon('https://google.com'),
      } as IDApp,
      ...(searchResult ?? []),
    ];
  }, [searchResult, searchValue]);

  const displaySearchList = useMemo(
    () => Array.isArray(searchList) && searchList.length > 0,
    [searchList],
  );
  const displayBookmarkList = useMemo(
    () => (bookmarkData ?? []).length > 0,
    [bookmarkData],
  );
  const displayHistoryList = useMemo(
    () => (historyData ?? []).length > 0,
    [historyData],
  );

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
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <ListItem
                  avatarProps={{
                    src: item.logo || item.originLogo || getUrlIcon(item.url),
                    fallbackProps: {
                      children: <Skeleton w="$10" h="$10" />,
                    },
                  }}
                  title={item.name}
                  subtitleProps={{
                    numberOfLines: 1,
                  }}
                  onPress={() => {
                    if (item._id === SEARCH_ITEM_ID) {
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
                      src={getUrlIcon(item.url)}
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
                      src: getUrlIcon(item.url),
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
