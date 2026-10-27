import { useCallback, useMemo, useRef, useState } from 'react';

import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { navigateToSettingsTabInModal } from './navigateToSettingsTab';
import {
  SETTINGS_SEARCH_LOG_IDLE_MS,
  getSettingsAnalyticsLayout,
  getSettingsItemAnalyticsId,
} from './settingsAnalytics';
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
  const { isTabNavigator, isMobileLayout, preferMobileNaming } =
    useSettingsLayout();
  const flattenSettingsConfig = useMemo(
    () => flattenSettingsSearchItems(settingsConfig, preferMobileNaming),
    [preferMobileNaming, settingsConfig],
  );
  const [searchResult, setSearchResult] = useState<ISettingsSearchResult[]>([]);
  const [searchText, setSearchText] = useState('');
  const searchFuse = useFuse(flattenSettingsConfig, {
    keys: [...SETTINGS_SEARCH_KEYS],
    shouldSort: true,
  });

  const searchTextRef = useRef<string>('');
  const lastLoggedQueryRef = useRef('');
  const layoutRef = useRef({ isTabNavigator, isMobileLayout });
  layoutRef.current = { isTabNavigator, isMobileLayout };
  const previousTabRoute = useRef<ESettingsTabNames>(
    getDefaultSettingsTab(settingsConfig),
  );
  const logIdleSearch = useDebouncedCallback(
    (query: string, resultCount: number, topResultId: string | null) => {
      if (!query || query === lastLoggedQueryRef.current) {
        return;
      }
      lastLoggedQueryRef.current = query;
      defaultLogger.setting.page.settingsSearched({
        queryLength: query.length,
        resultCount,
        topResultId,
        layout: getSettingsAnalyticsLayout(layoutRef.current),
      });
    },
    SETTINGS_SEARCH_LOG_IDLE_MS,
  );
  const onFocus = useCallback(() => {
    if (isTabNavigator && searchTextRef.current.length > 0) {
      navigateToSettingsTabInModal(ESettingsTabNames.Search);
    }
  }, [isTabNavigator]);
  const onSearch = useCallback(
    (nextSearchText: string) => {
      const query = normalizeSettingsSearchQuery(nextSearchText);
      if (query === searchTextRef.current) {
        return;
      }
      searchTextRef.current = query;
      // Only the list layout reads `searchText` from this hook. The sidebar
      // search pane gets the query from the event bus; updating state here
      // would re-render the sidebar on every keystroke.
      if (!isTabNavigator) {
        setSearchText(query);
      }
      const list = query ? searchFuse.search(query) : [];
      logIdleSearch.cancel();
      if (!query) {
        lastLoggedQueryRef.current = '';
      } else {
        const topItem = list[0]?.item;
        logIdleSearch(
          query,
          list.length,
          topItem ? getSettingsItemAnalyticsId(topItem) : null,
        );
      }
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
    [isTabNavigator, logIdleSearch, searchFuse, settingsConfig],
  );
  return useMemo(() => {
    return {
      isSearching: !isTabNavigator && searchText.length > 0,
      searchResult,
      searchText,
      onFocus,
      onSearch,
      previousTabRoute,
    };
  }, [isTabNavigator, onFocus, onSearch, searchResult, searchText]);
};
