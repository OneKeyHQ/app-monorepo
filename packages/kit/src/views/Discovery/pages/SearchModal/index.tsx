import { useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { InteractionManager, Keyboard } from 'react-native';

import {
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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

  const [searchList, setSearchList] = useState<IDApp[]>([]);
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
        ...(searchResult?.remoteData ?? []),
      ]);
    })();
  }, [searchValue, searchResult]);

  const displaySearchList = Array.isArray(searchList) && searchList.length > 0;
  const displayBookmarkList =
    (localData?.bookmarkData ?? []).length > 0 && !displaySearchList;
  const displayHistoryList = (localData?.historyData ?? []).length > 0;

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
            onFocus={(e) => {
              // Workaround for selectTextOnFocus={true} not working
              if (platformEnv.isNative) {
                const { currentTarget } = e;
                void InteractionManager.runAfterInteractions(() => {
                  currentTarget.setNativeProps({
                    selection: { start: 0, end: searchValue.length },
                  });
                });
              }
            }}
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
                  testID={`dapp-search${index}`}
                />
              ))}
            </Stack>
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
                testID={`dapp-search${index}`}
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
          ) : null}
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default withBrowserProvider(SearchModal);
