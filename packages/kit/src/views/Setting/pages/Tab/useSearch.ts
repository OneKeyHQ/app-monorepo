import { useCallback, useMemo, useRef, useState } from 'react';

import { groupBy } from 'lodash';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { getMobileSettingsPresentation, useSettingsConfig } from './config';
import { navigateToSettingsTabInModal } from './navigateToSettingsTab';
import { getDefaultSettingsTab } from './settingsRootLayout';
import {
  SETTINGS_SEARCH_KEYS,
  getSettingsSearchSectionItem,
} from './settingsSearchUtils';
import { useIsTabNavigator } from './useIsTabNavigator';

import type { ISubSettingConfig } from './config';
import type { FuseResult } from 'fuse.js';

export interface ISettingsSearchResult {
  title: string;
  icon?: string;
  configs: FuseResult<ISubSettingConfig>[];
}

export const useSearch = () => {
  const settingsConfig = useSettingsConfig();
  const isTabNavigator = useIsTabNavigator();
  const isMobileLayout = platformEnv.isNative && !isTabNavigator;
  const flattenSettingsConfig = useMemo(() => {
    return settingsConfig.filter(Boolean).flatMap((config) =>
      config
        ? config?.configs
            .filter(Boolean)
            .flat()
            .map((i) => {
              const mobilePresentation =
                isMobileLayout && i
                  ? getMobileSettingsPresentation(config, {
                      item: getSettingsSearchSectionItem(i),
                    })
                  : undefined;
              return {
                ...i,
                sectionTitle: mobilePresentation?.title || config.title,
                sectionIcon: mobilePresentation?.icon || config.icon,
              };
            })
        : [],
    );
  }, [isMobileLayout, settingsConfig]);
  const [searchResult, setSearchResult] = useState<ISettingsSearchResult[]>([]);
  const searchFuse = useFuse(flattenSettingsConfig, {
    keys: [...SETTINGS_SEARCH_KEYS],
    shouldSort: false,
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
      searchTextRef.current = searchText;
      const result = searchFuse.search(searchText);
      const sections = groupBy(result, 'item.sectionTitle');
      const keys = Object.keys(sections);
      const list = keys.map((key) => ({
        title: key,
        icon: sections[key][0]?.item?.sectionIcon || '',
        configs: sections[key] as FuseResult<ISubSettingConfig>[],
      }));
      if (isTabNavigator) {
        // The restore target can disappear at runtime (e.g. leaving dev mode
        // removes the Dev tab), so validate it before navigating.
        const restoreTab = settingsConfig.some(
          (category) => category?.name === previousTabRoute.current,
        )
          ? previousTabRoute.current
          : getDefaultSettingsTab(settingsConfig);
        navigateToSettingsTabInModal(
          searchText.length === 0 ? restoreTab : ESettingsTabNames.Search,
        );
        appEventBus.emitToSelf({
          type: EAppEventBusNames.SettingsSearchResult,
          payload: {
            list,
            searchText,
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
