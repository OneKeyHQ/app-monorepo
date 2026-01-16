import { useCallback, useMemo, useRef, useState } from 'react';

import { groupBy } from 'lodash';

import { rootNavigationRef } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { ESettingsTabNames, useSettingsConfig } from './config';
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
  const flattenSettingsConfig = useMemo(() => {
    return settingsConfig
      .filter(Boolean)
      .map((config) =>
        config
          ? config?.configs
              .filter(Boolean)
              .flat()
              .map((i) => ({
                ...i,
                sectionTitle: config.title,
                sectionIcon: config.icon,
              }))
          : [],
      )
      .flat();
  }, [settingsConfig]);
  const [searchResult, setSearchResult] = useState<ISettingsSearchResult[]>([]);
  const searchFuse = useFuse(flattenSettingsConfig, {
    keys: ['title', 'configs.title'],
    shouldSort: false,
  });

  const isTabNavigator = useIsTabNavigator();
  const searchTextRef = useRef<string>('');
  const previousTabRoute = useRef<ESettingsTabNames>(
    settingsConfig[0]?.name || ESettingsTabNames.Backup,
  );
  const onFocus = useCallback(() => {
    if (isTabNavigator && searchTextRef.current.length > 0) {
      rootNavigationRef.current?.navigate(
        EModalSettingRoutes.SettingListModal,
        {
          screen: ESettingsTabNames.Search,
        },
      );
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
        rootNavigationRef.current?.navigate(
          EModalSettingRoutes.SettingListModal,
          {
            screen:
              searchText.length === 0 && previousTabRoute.current
                ? previousTabRoute.current
                : ESettingsTabNames.Search,
          },
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
    [isTabNavigator, searchFuse],
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
