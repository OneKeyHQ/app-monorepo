import { ESettingsTabNames } from '@onekeyhq/shared/src/routes/setting';

import type { ISettingsConfig } from './config';

/**
 * Desktop sidebar chunks. The tab order mirrors the mobile settings home, but
 * the grouping is deliberately coarser (3-5 items per chunk) so whitespace
 * separation reads as intentional structure instead of fragmenting the short
 * list. Entries missing on a platform are dropped by `resolveSidebarGroups`
 * and empty chunks collapse.
 */
export const SETTINGS_SIDEBAR_GROUPS: ESettingsTabNames[][] = [
  [
    ESettingsTabNames.Wallet,
    ESettingsTabNames.Backup,
    ESettingsTabNames.Security,
    ESettingsTabNames.Connections,
    ESettingsTabNames.Network,
  ],
  [
    ESettingsTabNames.Notifications,
    ESettingsTabNames.Preferences,
    ESettingsTabNames.AppData,
  ],
  [ESettingsTabNames.About],
  [ESettingsTabNames.Dev],
];

export function resolveSidebarGroups(
  availableNames: string[],
): ESettingsTabNames[][] {
  const available = new Set(availableNames);
  return SETTINGS_SIDEBAR_GROUPS.map((group) =>
    group.filter((name) => available.has(name)),
  ).filter((group) => group.length > 0);
}

/**
 * First visible real category of the (already sorted) settings config. Used
 * for both the tab navigator's initial route and the search restore target so
 * the two can never drift apart.
 */
export function getDefaultSettingsTab(
  settingsConfig: ISettingsConfig,
): ESettingsTabNames {
  const firstVisible = settingsConfig.find(
    (category) => category && !category.isHidden && !category.desktopOnlyTab,
  );
  return firstVisible?.name ?? ESettingsTabNames.Backup;
}
