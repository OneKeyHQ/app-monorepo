import { useCallback, useMemo } from 'react';

import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import {
  EUniversalSearchType,
  type IUniversalSearchSettings,
} from '@onekeyhq/shared/types/search';

import {
  type ISubSettingConfig,
  useSettingsConfig,
} from '../../Setting/pages/Tab/config';

interface IFlatSettingsItem extends ISubSettingConfig {
  sectionName?: string;
  sectionTitle: string;
  sectionIcon: string;
}

export function useSettingsSearch() {
  const settingsConfig = useSettingsConfig();

  const flattenSettingsConfig = useMemo(
    () =>
      settingsConfig.filter(Boolean).flatMap((config) =>
        config.configs
          .flat()
          .filter((i): i is ISubSettingConfig => i !== null && i !== undefined)
          .map(
            (i) =>
              ({
                ...i,
                sectionName: config.name,
                sectionTitle: config.title,
                sectionIcon: config.icon,
              }) as IFlatSettingsItem,
          ),
      ),
    [settingsConfig],
  );

  const searchFuse = useFuse(flattenSettingsConfig, {
    keys: ['title', 'keywords'],
    shouldSort: true,
  });

  const searchSettings = useCallback(
    (input: string): IUniversalSearchSettings[] => {
      if (!input.trim()) return [];
      const results = searchFuse.search(input);
      return results.map((result) => ({
        type: EUniversalSearchType.Settings,
        payload: {
          title: result.item.title,
          icon: result.item.icon,
          sectionName: result.item.sectionName,
          sectionTitle: result.item.sectionTitle,
          sectionIcon: result.item.sectionIcon,
          keywords: result.item.keywords,
          settingRoute: result.item.settingRoute,
          onPress: result.item.onPress,
        },
      }));
    },
    [searchFuse],
  );

  return searchSettings;
}
