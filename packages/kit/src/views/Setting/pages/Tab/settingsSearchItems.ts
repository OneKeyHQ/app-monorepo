import type { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import {
  getSettingsDisplayIcon,
  getSettingsDisplayTitle,
} from './settingsDisplay';

import type { ISettingsConfig, ISubSettingConfig } from './config';

export type IFlatSettingsSearchItem = ISubSettingConfig & {
  sectionName: ESettingsTabNames;
  sectionTitle: string;
  sectionIcon: string;
};

export function flattenSettingsSearchItems(
  settingsConfig: ISettingsConfig,
  preferMobileNaming: boolean,
): IFlatSettingsSearchItem[] {
  return settingsConfig.filter(Boolean).flatMap((config) =>
    config.configs
      .flat()
      .filter((item): item is ISubSettingConfig => Boolean(item))
      .filter((item) => item.searchable !== false)
      .map((item) => ({
        ...item,
        sectionName: config.name,
        sectionTitle: getSettingsDisplayTitle(config, preferMobileNaming),
        sectionIcon: getSettingsDisplayIcon(config, preferMobileNaming),
      })),
  );
}
