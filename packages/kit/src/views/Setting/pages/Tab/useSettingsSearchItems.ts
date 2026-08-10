import { useMemo } from 'react';

import type { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { useSettingsConfig } from './config';
import {
  getSettingsDisplayIcon,
  getSettingsDisplayTitle,
} from './settingsDisplay';
import { useSettingsLayout } from './useIsTabNavigator';

import type { ISettingsConfig, ISubSettingConfig } from './config';

export type IFlatSettingsSearchItem = ISubSettingConfig & {
  sectionName: ESettingsTabNames;
  sectionTitle: string;
  sectionIcon: string;
};

/**
 * Settings items flattened for search, each carrying its category's display
 * grouping (resolved through `getSettingsDisplayTitle`/`Icon`, so grouping
 * follows the same naming rule as the sidebar and pane headers). Shared by
 * the settings pane search and universal search so the two pipelines cannot
 * drift. Callers that already hold a `useSettingsConfig` instance should use
 * the pure function to avoid mounting a second config hook.
 */
export function flattenSettingsSearchItems(
  settingsConfig: ISettingsConfig,
  preferMobileNaming: boolean,
): IFlatSettingsSearchItem[] {
  return settingsConfig.filter(Boolean).flatMap((config) =>
    config.configs
      .flat()
      .filter((item): item is ISubSettingConfig => Boolean(item))
      .map((item) => ({
        ...item,
        sectionName: config.name,
        sectionTitle: getSettingsDisplayTitle(config, preferMobileNaming),
        sectionIcon: getSettingsDisplayIcon(config, preferMobileNaming),
      })),
  );
}

export function useFlatSettingsSearchItems(): IFlatSettingsSearchItem[] {
  const settingsConfig = useSettingsConfig();
  const { preferMobileNaming } = useSettingsLayout();
  return useMemo(
    () => flattenSettingsSearchItems(settingsConfig, preferMobileNaming),
    [preferMobileNaming, settingsConfig],
  );
}
