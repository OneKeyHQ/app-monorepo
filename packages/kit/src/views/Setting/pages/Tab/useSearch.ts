import { useCallback, useMemo, useRef, useState } from 'react';

import { groupBy } from 'lodash';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';

import { useSettingsConfig } from './config';

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

  const searchTextRef = useRef<string>('');
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
      setSearchResult(list);
      appEventBus.emit(EAppEventBusNames.SettingsSearchResult, {
        list,
        searchText,
      });
    },
    [searchFuse],
  );
  return {
    isSearching: searchTextRef.current.length > 0,
    searchResult,
    onSearch,
  };
};
