import { ESettingsTabNames } from '@onekeyhq/shared/src/routes/setting';

import type { ISettingsConfig } from './config';

/**
 * Desktop sidebar groups mirror the mobile settings home cards. Entries
 * missing on a platform are dropped by `resolveSidebarGroups` and empty
 * groups collapse.
 */
export const SETTINGS_SIDEBAR_GROUPS: ESettingsTabNames[][] = [
  [
    ESettingsTabNames.Wallet,
    ESettingsTabNames.Backup,
    ESettingsTabNames.Security,
  ],
  [ESettingsTabNames.Connections, ESettingsTabNames.Network],
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
 * Registered, visible tab names missing from `SETTINGS_SIDEBAR_GROUPS`. Such
 * tabs would silently never render in the sidebar (their pane stays reachable
 * only through search), so callers surface them as a dev warning.
 */
export function findSidebarOrphans(availableNames: string[]): string[] {
  const grouped = new Set<string>(SETTINGS_SIDEBAR_GROUPS.flat());
  return availableNames.filter((name) => !grouped.has(name));
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
