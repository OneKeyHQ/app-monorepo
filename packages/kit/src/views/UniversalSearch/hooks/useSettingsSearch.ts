import { useCallback, useMemo } from 'react';

import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EMobileSettingsSubpage } from '@onekeyhq/shared/src/routes';
import {
  EUniversalSearchType,
  type IUniversalSearchSettings,
} from '@onekeyhq/shared/types/search';

import {
  type ISubSettingConfig,
  getMobileSettingsPresentation,
  useSettingsConfig,
} from '../../Setting/pages/Tab/config';
import {
  SETTINGS_SEARCH_KEYS,
  getSettingsSearchSectionItem,
} from '../../Setting/pages/Tab/settingsSearchUtils';
import { useIsTabNavigator } from '../../Setting/pages/Tab/useIsTabNavigator';

interface IFlatSettingsItem extends ISubSettingConfig {
  sectionName?: string;
  sectionTitle: string;
  sectionIcon: string;
  mobileSubpage?: EMobileSettingsSubpage;
}

export function useSettingsSearch() {
  const settingsConfig = useSettingsConfig();
  const isTabNavigator = useIsTabNavigator();
  const isMobileLayout = platformEnv.isNative && !isTabNavigator;

  const flattenSettingsConfig = useMemo(
    () =>
      settingsConfig.filter(Boolean).flatMap((config) =>
        config.configs
          .flat()
          .filter((i): i is ISubSettingConfig => i !== null && i !== undefined)
          .map((i) => {
            const mobilePresentation = isMobileLayout
              ? getMobileSettingsPresentation(config, {
                  item: getSettingsSearchSectionItem(i),
                })
              : undefined;
            return {
              ...i,
              sectionName: config.name,
              sectionTitle: mobilePresentation?.title || config.title,
              sectionIcon: mobilePresentation?.icon || config.icon,
              mobileSubpage: mobilePresentation?.mobileSubpage,
            } as IFlatSettingsItem;
          }),
      ),
    [isMobileLayout, settingsConfig],
  );

  const searchFuse = useFuse(flattenSettingsConfig, {
    keys: [...SETTINGS_SEARCH_KEYS],
    shouldSort: true,
  });

  const searchSettings = useCallback(
    (input: string): IUniversalSearchSettings[] => {
      if (!input.trim()) return [];
      const results = searchFuse.search(input);
      return results.map((result) => ({
        type: EUniversalSearchType.Settings,
        payload: {
          title:
            (isMobileLayout ? result.item.mobileTitle : undefined) ||
            result.item.title,
          icon: result.item.icon,
          sectionName: result.item.sectionName,
          sectionTitle: result.item.sectionTitle,
          sectionIcon: result.item.sectionIcon,
          keywords: result.item.keywords,
          settingRoute: result.item.settingRoute,
          mobileSubpage: result.item.mobileSubpage,
          settingsTab: result.item.desktopTab,
          onPress: result.item.onPress,
        },
      }));
    },
    [isMobileLayout, searchFuse],
  );

  return searchSettings;
}
