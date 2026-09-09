import { useCallback } from 'react';

import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import {
  EUniversalSearchType,
  type IUniversalSearchSettings,
} from '@onekeyhq/shared/types/search';

import { getSettingsDisplayTitle } from '../../Setting/pages/Tab/settingsDisplay';
import {
  SETTINGS_SEARCH_KEYS,
  normalizeSettingsSearchQuery,
} from '../../Setting/pages/Tab/settingsSearchUtils';
import { useSettingsLayout } from '../../Setting/pages/Tab/useIsTabNavigator';
import { useFlatSettingsSearchItems } from '../../Setting/pages/Tab/useSettingsSearchItems';

export function useSettingsSearch() {
  const { preferMobileNaming } = useSettingsLayout();

  const flattenSettingsConfig = useFlatSettingsSearchItems();

  const searchFuse = useFuse(flattenSettingsConfig, {
    keys: [...SETTINGS_SEARCH_KEYS],
    shouldSort: true,
  });

  const searchSettings = useCallback(
    (input: string): IUniversalSearchSettings[] => {
      const query = normalizeSettingsSearchQuery(input);
      if (!query) return [];
      const results = searchFuse.search(query);
      return results.map((result) => ({
        type: EUniversalSearchType.Settings,
        payload: {
          id: result.item.id,
          title: getSettingsDisplayTitle(result.item, preferMobileNaming),
          icon: result.item.icon,
          sectionName: result.item.sectionName,
          sectionTitle: result.item.sectionTitle,
          sectionIcon: result.item.sectionIcon,
          keywords: result.item.keywords,
          settingRoute: result.item.settingRoute,
          settingsTab: result.item.desktopTab,
          onPress: result.item.onPress,
        },
      }));
    },
    [preferMobileNaming, searchFuse],
  );

  return searchSettings;
}
