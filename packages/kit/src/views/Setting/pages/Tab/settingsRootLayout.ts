import { ESettingsTabNames } from '@onekeyhq/shared/src/routes/setting';

import type { ISettingCategoryConfig, ISettingsConfig } from './config';

/** Desktop and desktop-style tablet sidebars use one continuous list. */
export const SETTINGS_SIDEBAR_ORDER: ESettingsTabNames[] = [
  ESettingsTabNames.Wallet,
  ESettingsTabNames.Backup,
  ESettingsTabNames.Security,
  ESettingsTabNames.Connections,
  ESettingsTabNames.Network,
  ESettingsTabNames.Notifications,
  ESettingsTabNames.Preferences,
  ESettingsTabNames.AppData,
  ESettingsTabNames.About,
  ESettingsTabNames.Dev,
];

export function resolveSidebarItems(
  availableNames: string[],
): ESettingsTabNames[] {
  const available = new Set(availableNames);
  return SETTINGS_SIDEBAR_ORDER.filter((name) => available.has(name));
}

/**
 * Registered, visible tab names missing from `SETTINGS_SIDEBAR_ORDER`. Such
 * tabs would silently never render in the sidebar (their pane stays reachable
 * only through search), so callers surface them as a dev warning.
 */
export function findSidebarOrphans(availableNames: string[]): string[] {
  const ordered = new Set<string>(SETTINGS_SIDEBAR_ORDER);
  return availableNames.filter((name) => !ordered.has(name));
}

/**
 * A category the list/home surfaces actually render: present, not hidden,
 * and not a synthetic desktop-only tab. Shared with the default-tab pick so
 * the initial route and the rendered lists can never disagree.
 */
export function isVisibleSettingsCategory(
  category: ISettingsConfig[number],
): category is ISettingCategoryConfig {
  return Boolean(category && !category.isHidden && !category.desktopOnlyTab);
}

/**
 * First visible real category of the (already sorted) settings config. Used
 * for both the tab navigator's initial route and the search restore target so
 * the two can never drift apart.
 */
export function getDefaultSettingsTab(
  settingsConfig: ISettingsConfig,
): ESettingsTabNames {
  return (
    settingsConfig.find(isVisibleSettingsCategory)?.name ??
    ESettingsTabNames.Backup
  );
}

export function resolveSettingsRootInsets({
  isMobileLayout,
  isNativeAndroid,
  bottomInset,
}: {
  isMobileLayout: boolean;
  isNativeAndroid: boolean;
  bottomInset: number;
}) {
  return {
    // Phone Settings owns its inset inside the scroll content so Page does not
    // reserve a fixed footer block. Wider layouts keep the Page default.
    pageSafeAreaEnabled: !isMobileLayout,
    // UIKit handles automatic ScrollView insets on iOS. Android needs the
    // system navigation inset added explicitly to the scrollable content.
    scrollBottomInset: isMobileLayout && isNativeAndroid ? bottomInset : 0,
  };
}
