import { useCallback, useMemo, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { navigateToSettingsTabInModal } from './navigateToSettingsTab';
import { getDefaultSettingsTab } from './settingsRootLayout';
import {
  SETTINGS_SEARCH_KEYS,
  normalizeSettingsSearchQuery,
} from './settingsSearchUtils';
import { useSettingsLayout } from './useIsTabNavigator';
import { flattenSettingsSearchItems } from './useSettingsSearchItems';

import type { ISettingsConfig } from './config';
import type { IFlatSettingsSearchItem } from './useSettingsSearchItems';
import type { FuseResult } from 'fuse.js';

export type ISettingsSearchResult = FuseResult<IFlatSettingsSearchItem>;

export const useSearch = (settingsConfig: ISettingsConfig) => {
  const { isTabNavigator, preferMobileNaming } = useSettingsLayout();
  const flattenSettingsConfig = useMemo(
    () => flattenSettingsSearchItems(settingsConfig, preferMobileNaming),
    [preferMobileNaming, settingsConfig],
  );
  const [searchResult, setSearchResult] = useState<ISettingsSearchResult[]>([]);
  const searchFuse = useFuse(flattenSettingsConfig, {
    keys: [...SETTINGS_SEARCH_KEYS],
    shouldSort: true,
  });

  const searchTextRef = useRef<string>('');
  const previousTabRoute = useRef<ESettingsTabNames>(
    getDefaultSettingsTab(settingsConfig),
  );
  const onFocus = useCallback(() => {
    if (isTabNavigator && searchTextRef.current.length > 0) {
      navigateToSettingsTabInModal(ESettingsTabNames.Search);
    }
  }, [isTabNavigator]);
  const onSearch = useCallback(
    (searchText: string) => {
      const query = normalizeSettingsSearchQuery(searchText);
      searchTextRef.current = query;
      const list = query ? searchFuse.search(query) : [];
      if (isTabNavigator) {
        let targetTab = ESettingsTabNames.Search;
        if (!query) {
          // The restore target can disappear at runtime (e.g. leaving dev mode
          // removes the Dev tab), so validate it before navigating.
          targetTab = settingsConfig.some(
            (category) => category?.name === previousTabRoute.current,
          )
            ? previousTabRoute.current
            : getDefaultSettingsTab(settingsConfig);
        }
        navigateToSettingsTabInModal(targetTab);
        appEventBus.emitToSelf({
          type: EAppEventBusNames.SettingsSearchResult,
          payload: {
            list,
            searchText: query,
          },
          cloned: false,
        });
      } else {
        setSearchResult(list);
      }
    },
    [isTabNavigator, searchFuse, settingsConfig],
  );
  return useMemo(() => {
    return isTabNavigator
      ? {
          isSearching: false,
          searchResult: [],
          onFocus,
          onSearch,
          previousTabRoute,
        }
      : {
          isSearching: searchTextRef.current.length > 0,
          searchResult,
          onSearch,
          onFocus,
          previousTabRoute,
        };
  }, [isTabNavigator, onFocus, onSearch, searchResult]);
};
