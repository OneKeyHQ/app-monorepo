import {
  EModalSettingRoutes,
  ESettingsTabNames,
} from '@onekeyhq/shared/src/routes';

import {
  getSettingsAnalyticsLayout,
  getSettingsItemAnalyticsId,
  logSettingCategoryOpened,
  logSettingItemClicked,
  logSettingValueChanged,
  maybeLogSettingsSearchResultClick,
} from './settingsAnalytics';

const mockSettingCategoryOpened = jest.fn();
const mockSettingItemClicked = jest.fn();
const mockSettingValueChanged = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: {
      page: {
        settingCategoryOpened: (...args: unknown[]) => {
          mockSettingCategoryOpened(...args);
        },
        settingItemClicked: (...args: unknown[]) => {
          mockSettingItemClicked(...args);
        },
        settingValueChanged: (...args: unknown[]) => {
          mockSettingValueChanged(...args);
        },
      },
    },
  },
}));

describe('settingsAnalytics helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers an explicit kebab id over the setting route', () => {
    expect(
      getSettingsItemAnalyticsId({
        id: 'notifications',
        settingRoute: EModalSettingRoutes.SettingNotifications,
      }),
    ).toBe('notifications');
  });

  it('falls back to the setting route when no id is set', () => {
    expect(
      getSettingsItemAnalyticsId({
        settingRoute: EModalSettingRoutes.SettingProtectModal,
      }),
    ).toBe(EModalSettingRoutes.SettingProtectModal);
  });

  it('returns null when neither an id nor a setting route exists', () => {
    expect(getSettingsItemAnalyticsId({})).toBeNull();
  });

  it('maps layout axes to a single analytics layout value', () => {
    expect(
      getSettingsAnalyticsLayout({
        isTabNavigator: false,
        isMobileLayout: true,
      }),
    ).toBe('mobile');
    expect(
      getSettingsAnalyticsLayout({
        isTabNavigator: true,
        isMobileLayout: false,
      }),
    ).toBe('sidebar');
    expect(
      getSettingsAnalyticsLayout({
        isTabNavigator: false,
        isMobileLayout: false,
      }),
    ).toBe('flat');
  });

  it('does not log item clicks in the Dev category', () => {
    logSettingItemClicked({
      item: { id: 'dev-mode' },
      category: ESettingsTabNames.Dev,
      source: 'sidebar',
    });
    expect(mockSettingItemClicked).not.toHaveBeenCalled();
  });

  it('does not log category opens for Dev or Search', () => {
    logSettingCategoryOpened({
      category: ESettingsTabNames.Dev,
      source: 'sidebar',
    });
    logSettingCategoryOpened({
      category: ESettingsTabNames.Search,
      source: 'sidebar',
    });
    expect(mockSettingCategoryOpened).not.toHaveBeenCalled();
  });

  it('skips no-op preference changes', () => {
    logSettingValueChanged({
      itemId: 'theme',
      from: 'dark',
      to: 'dark',
    });
    expect(mockSettingValueChanged).not.toHaveBeenCalled();
  });

  it('logs a search-result click on an in-place Select or Switch', () => {
    const logItemClick = jest.fn();
    maybeLogSettingsSearchResultClick({
      source: 'search',
      logItemClick,
    });
    expect(logItemClick).toHaveBeenCalledTimes(1);
  });

  it('does not treat opening an in-place control as a click while browsing', () => {
    const logItemClick = jest.fn();
    maybeLogSettingsSearchResultClick({
      source: 'categoryPage',
      logItemClick,
    });
    maybeLogSettingsSearchResultClick({
      source: 'sidebar',
      logItemClick,
    });
    expect(logItemClick).not.toHaveBeenCalled();
  });
});
