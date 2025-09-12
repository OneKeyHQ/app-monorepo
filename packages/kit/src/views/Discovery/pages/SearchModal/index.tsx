import { useCallback, useMemo, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Page, ScrollView, SearchBar, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import type {
  EDiscoveryModalRoutes,
  IDiscoveryModalParamList,
} from '@onekeyhq/shared/src/routes';

import { SearchResultContent } from '../../components/SearchResultContent';
import { useSearchModalData } from '../../hooks/useSearchModalData';
import { useWebSiteHandler } from '../../hooks/useWebSiteHandler';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { RouteProp } from '@react-navigation/core';

function SearchModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IDiscoveryModalParamList, EDiscoveryModalRoutes.SearchModal>
    >();
  const { useCurrentWindow, tabId, url = '' } = route.params ?? {};

  const [searchValue, setSearchValue] = useState(url);
  const handleWebSite = useWebSiteHandler();

  const {
    localData,
    refreshLocalData,
    searchList,
    displaySearchList,
    displayBookmarkList,
    displayHistoryList,
    SEARCH_ITEM_ID,
  } = useSearchModalData(searchValue);

  useFocusEffect(
    useCallback(() => {
      setTimeout(() => {
        void refreshLocalData();
      }, 300);
    }, [refreshLocalData]),
  );

  return useMemo(
    () => (
      <Page safeAreaEnabled>
        <Page.Header
          headerTitle={intl.formatMessage({
            id: ETranslations.explore_search_placeholder,
          })}
        />
        <Page.Body>
          <Stack mx="$4">
            <SearchBar
              autoFocus
              zIndex={20}
              selectTextOnFocus
              value={searchValue}
              onSearchTextChange={setSearchValue}
              placeholder={intl.formatMessage({
                id: ETranslations.browser_search_dapp_or_enter_url,
              })}
              onSubmitEditing={() => {
                if (!searchValue) {
                  navigation.pop();
                } else {
                  handleWebSite({
                    webSite: {
                      url: searchValue,
                      title: searchValue,
                      logo: undefined,
                      sortIndex: undefined,
                    },
                    useCurrentWindow,
                    tabId,
                    enterMethod: EEnterMethod.addressBar,
                  });
                }
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
            <SearchResultContent
              searchValue={searchValue}
              localData={localData}
              searchList={searchList}
              displaySearchList={displaySearchList}
              displayBookmarkList={displayBookmarkList}
              displayHistoryList={displayHistoryList}
              SEARCH_ITEM_ID={SEARCH_ITEM_ID}
              useCurrentWindow={useCurrentWindow}
              tabId={tabId}
              onItemClick={() => {
                navigation.pop();
              }}
            />
          </ScrollView>
        </Page.Body>
      </Page>
    ),
    [
      SEARCH_ITEM_ID,
      displayBookmarkList,
      displayHistoryList,
      displaySearchList,
      handleWebSite,
      intl,
      localData,
      navigation,
      searchList,
      searchValue,
      tabId,
      useCurrentWindow,
    ],
  );
}

export default withBrowserProvider(SearchModal);
