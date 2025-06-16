import { useCallback, useMemo, useRef, useState } from 'react';

import { groupBy } from 'lodash';

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
      const result = searchFuse.search(searchText);
      if (result.length === 0) {
        setSearchResult([]);
        return;
      }
      const sections = groupBy(result, 'item.sectionTitle');
      const keys = Object.keys(sections);
      setSearchResult(
        keys.map((key) => ({
          title: key,
          icon: sections[key][0]?.item?.sectionIcon || '',
          configs: sections[key] as FuseResult<ISubSettingConfig>[],
        })),
      );
    },
    [searchFuse],
  );
  return {
    isSearching: searchTextRef.current.length > 0,
    searchResult,
    onSearch,
  };
};
