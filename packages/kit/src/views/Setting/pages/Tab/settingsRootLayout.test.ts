import { ESettingsTabNames } from '@onekeyhq/shared/src/routes/setting';

import {
  findSidebarOrphans,
  getDefaultSettingsTab,
  resolveSettingsRootInsets,
  resolveSidebarItems,
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

describe('resolveSidebarItems', () => {
  it('returns one ordered desktop list when every tab exists', () => {
    expect(
      resolveSidebarItems([
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
    ]);
  });

  it('drops missing tabs while preserving sidebar order', () => {
    expect(
      resolveSidebarItems([
        ESettingsTabNames.Preferences,
        ESettingsTabNames.About,
      ]),
    ).toEqual([ESettingsTabNames.Preferences, ESettingsTabNames.About]);
  });

  it('ignores names outside the sidebar layout', () => {
    expect(resolveSidebarItems([ESettingsTabNames.Search])).toEqual([]);
  });
});

describe('findSidebarOrphans', () => {
  it('flags visible tabs missing from the sidebar order', () => {
    expect(
      findSidebarOrphans([
        ESettingsTabNames.Wallet,
        ESettingsTabNames.OneKeyID,
      ]),
    ).toEqual([ESettingsTabNames.OneKeyID]);
  });

  it('returns nothing when every tab is ordered', () => {
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

describe('resolveSettingsRootInsets', () => {
  it.each([
    {
      name: 'iOS phone',
      input: {
        isMobileLayout: true,
        isNativeAndroid: false,
        bottomInset: 34,
      },
      expected: { pageSafeAreaEnabled: false, scrollBottomInset: 0 },
    },
    {
      name: 'Android phone',
      input: {
        isMobileLayout: true,
        isNativeAndroid: true,
        bottomInset: 24,
      },
      expected: { pageSafeAreaEnabled: false, scrollBottomInset: 24 },
    },
    {
      name: 'desktop or tablet',
      input: {
        isMobileLayout: false,
        isNativeAndroid: false,
        bottomInset: 34,
      },
      expected: { pageSafeAreaEnabled: true, scrollBottomInset: 0 },
    },
    {
      name: 'Android phone without a bottom inset',
      input: {
        isMobileLayout: true,
        isNativeAndroid: true,
        bottomInset: 0,
      },
      expected: { pageSafeAreaEnabled: false, scrollBottomInset: 0 },
    },
  ])('resolves $name without a fixed mobile footer', ({ input, expected }) => {
    expect(resolveSettingsRootInsets(input)).toEqual(expected);
  });
});
