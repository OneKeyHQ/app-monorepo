import { ESettingsTabNames } from '@onekeyhq/shared/src/routes/setting';

import {
  findSidebarOrphans,
  getDefaultSettingsTab,
  resolveSidebarGroups,
} from './settingsRootLayout';

import type { ISettingsConfig } from './config';

function buildConfig(
  categories: {
    name: ESettingsTabNames;
    isHidden?: boolean;
    desktopOnlyTab?: boolean;
  }[],
): ISettingsConfig {
  return categories.map((category) => ({
    ...category,
    icon: 'PlaceholderOutline',
    title: category.name,
    configs: [],
  })) as unknown as ISettingsConfig;
}

describe('resolveSidebarGroups', () => {
  it('mirrors the mobile card grouping when every tab exists', () => {
    expect(
      resolveSidebarGroups([
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
      ]),
    ).toEqual([
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
    ]);
  });

  it('drops missing tabs and collapses empty groups', () => {
    expect(
      resolveSidebarGroups([
        ESettingsTabNames.Preferences,
        ESettingsTabNames.About,
      ]),
    ).toEqual([[ESettingsTabNames.Preferences], [ESettingsTabNames.About]]);
  });

  it('ignores names outside the sidebar layout', () => {
    expect(resolveSidebarGroups([ESettingsTabNames.Search])).toEqual([]);
  });
});

describe('findSidebarOrphans', () => {
  it('flags visible tabs missing from the sidebar groups', () => {
    expect(
      findSidebarOrphans([
        ESettingsTabNames.Wallet,
        ESettingsTabNames.OneKeyID,
      ]),
    ).toEqual([ESettingsTabNames.OneKeyID]);
  });

  it('returns nothing when every tab is grouped', () => {
    expect(
      findSidebarOrphans([ESettingsTabNames.Wallet, ESettingsTabNames.Dev]),
    ).toEqual([]);
  });
});

describe('getDefaultSettingsTab', () => {
  it('returns the first visible category', () => {
    expect(
      getDefaultSettingsTab(
        buildConfig([
          { name: ESettingsTabNames.Wallet },
          { name: ESettingsTabNames.Backup },
        ]),
      ),
    ).toBe(ESettingsTabNames.Wallet);
  });

  it('skips hidden categories and derived link tabs', () => {
    expect(
      getDefaultSettingsTab(
        buildConfig([
          { name: ESettingsTabNames.Search, isHidden: true },
          { name: ESettingsTabNames.Notifications, desktopOnlyTab: true },
          { name: ESettingsTabNames.Preferences },
        ]),
      ),
    ).toBe(ESettingsTabNames.Preferences);
  });

  it('falls back to Backup for an empty config', () => {
    expect(getDefaultSettingsTab([])).toBe(ESettingsTabNames.Backup);
  });
});
