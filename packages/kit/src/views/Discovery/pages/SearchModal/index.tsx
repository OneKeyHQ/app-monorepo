import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { Keyboard } from 'react-native';

import {
  Icon,
  Image,
  Page,
  ScrollView,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import { DappSearchModalSectionHeader } from './DappSearchModalSectionHeader';

import type { RouteProp } from '@react-navigation/core';

const SEARCH_ITEM_ID = 'SEARCH_ITEM_ID';

function SearchModal() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IDiscoveryModalParamList, EDiscoveryModalRoutes.SearchModal>
    >();
  const { useCurrentWindow, tabId, url = '' } = route.params ?? {};

  const [searchValue, setSearchValue] = useState(url);
  const { handleOpenWebSite } = useBrowserAction().current;

  const { serviceDiscovery } = backgroundApiProxy;
  const { result: localData, run: refreshLocalData } =
    usePromiseResult(async () => {
      const bookmarkData = await serviceDiscovery.getBookmarkData({
        generateIcon: true,
        sliceCount: 8,
      });
      const historyData = await serviceDiscovery.getHistoryData({
        generateIcon: true,
        sliceCount: 8,
        keyword: searchValue ?? undefined,
      });
      return {
        bookmarkData,
        historyData,
      };
    }, [serviceDiscovery, searchValue]);

  const { result: searchResult } = usePromiseResult(async () => {
    const res = await serviceDiscovery.searchDApp(searchValue);
    return {
      remoteData: res,
    };
  }, [searchValue, serviceDiscovery]);

  const jumpPageRef = useRef(false);
  useFocusEffect(() => {
    if (jumpPageRef.current) {
      setTimeout(() => {
        void refreshLocalData();
      }, 300);
      jumpPageRef.current = false;
    }
  });

  const [searchList, setSearchList] = useState<(IDApp | IFuseResult<IDApp>)[]>(
    [],
  );

  const fuseRemoteDataSearch = useFuse(searchResult?.remoteData, {
    keys: ['name'],
  });

  useEffect(() => {
    void (async () => {
      if (!searchValue) {
        setSearchList([]);
        return;
      }
      const logo =
        await backgroundApiProxy.serviceDiscovery.buildWebsiteIconUrl(
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
        ...fuseRemoteDataSearch.search(searchValue),
      ]);
    })();
  }, [searchValue, searchResult, fuseRemoteDataSearch]);

  const displaySearchList = Array.isArray(searchList) && searchList.length > 0;
  const displayBookmarkList =
    (localData?.bookmarkData ?? []).length > 0 && !displaySearchList;
  const displayHistoryList = (localData?.historyData ?? []).length > 0;

  const renderList = useCallback(
    (list: (IDApp | IFuseResult<IDApp>)[]) =>
      list.map((rawItem, index) => {
        const item = (rawItem as IFuseResult<IDApp>).item
          ? (rawItem as IFuseResult<IDApp>).item
          : (rawItem as IDApp);
        return (
          <ListItem
            key={index}
            avatarProps={{
              src: item.logo || item.originLogo,
              loading: (
                <Image.Loading>
                  <Skeleton width="100%" height="100%" />
                </Image.Loading>
              ),
              fallbackProps: {
                bg: '$bgStrong',
                justifyContent: 'center',
                alignItems: 'center',
                children: <Icon name="GlobusOutline" />,
              },
            }}
            title={item.name}
            titleMatch={(rawItem as IFuseResult<IDApp>).matches?.find(
              (v) => v.key === 'name',
            )}
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
        );
      }),
    [handleOpenWebSite, navigation, searchValue, tabId, useCurrentWindow],
  );

  return (
    <Page safeAreaEnabled>
      <Page.Header headerTitle="Search" />
      <Page.Body>
        <Stack mx="$4">
          <SearchBar
            autoFocus
            zIndex={20}
            selectTextOnFocus
            value={searchValue}
            onSearchTextChange={setSearchValue}
            onSubmitEditing={() => {
              handleOpenWebSite({
                navigation,
                useCurrentWindow,
                tabId,
                webSite: {
                  url: searchValue,
                  title: searchValue,
                },
              });
            }}
          />
        </Stack>
        <ScrollView
          pt="$2"
          pb="$5"
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {displaySearchList ? (
            <Stack pb="$5">{renderList(searchList)}</Stack>
          ) : null}

          {displayBookmarkList ? (
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
          ) : null}
          {displayHistoryList ? (
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
              {localData?.historyData.map((item, index) => (
                <ListItem
                  key={index}
                  avatarProps={{
                    src: item.logo,
                    loading: (
                      <Image.Loading>
                        <Skeleton width="100%" height="100%" />
                      </Image.Loading>
                    ),
                    fallbackProps: {
                      bg: '$bgStrong',
                      justifyContent: 'center',
                      alignItems: 'center',
                      children: <Icon name="GlobusOutline" />,
                    },
                  }}
                  title={item.title}
                  titleMatch={item.titleMatch}
                  subtitle={item.url}
                  subTitleMatch={item.urlMatch}
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
          ) : null}
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(SearchModal);
