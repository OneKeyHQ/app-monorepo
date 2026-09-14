/** @jest-environment jsdom */

import SettingTab from './';

import { fireEvent, render, renderHook, waitFor } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { SettingTestIDs } from '../../testIDs';

import { useSettingsConfig } from './config';

const mockPlatform = platformEnv;
let mockGtMd = false;
let mockTravelMode = false;
const mockNavigation = {
  dispatch: jest.fn(),
  emit: jest.fn(() => ({ defaultPrevented: false })),
  push: jest.fn(),
  setOptions: jest.fn(),
};
const mockCategoryOpened = jest.fn();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('react-native', () => ({
  Keyboard: { dismiss: jest.fn() },
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeIOS: true,
    isNativeIOSPad: true,
    isNativeAndroid: false,
  },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockTravelMode ? 'travel-mode' : 'normal' },
    }),
  },
}));
jest.mock('@onekeyhq/shared/src/locale', () =>
  jest.requireActual<
    typeof import('@onekeyhq/shared/src/locale/enum/translations')
  >('@onekeyhq/shared/src/locale/enum/translations'),
);
jest.mock('@onekeyhq/shared/src/keyboard', () => ({
  dismissKeyboardWithDelay: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: {
      page: {
        settingsOpened: jest.fn(),
        settingCategoryOpened: (...args: unknown[]) => {
          mockCategoryOpened(...args);
        },
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Divider: () => null,
    Icon: { prefetch: jest.fn().mockResolvedValue(undefined) },
    Page: Object.assign(Stack, { Header: () => null, Body: Stack }),
    ScrollView: Stack,
    SearchBar: () => React.createElement('input', { 'aria-label': 'Search' }),
    XStack: Stack,
    YStack: Stack,
    getTokenValue: () => 16,
    isNativeTablet: () => mockPlatform.isNativeIOSPad || mockGtMd,
    useMedia: () => ({ gtMd: mockGtMd }),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    DesktopTabItem: ({
      label,
      onPress,
      selected,
      testID,
    }: {
      label: string;
      onPress: () => void;
      selected: boolean;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          onClick: onPress,
          'aria-current': selected ? 'page' : undefined,
          'data-testid': testID,
        },
        label,
      ),
  };
});
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    navigate: (payload: unknown) => ({ type: 'NAVIGATE', payload }),
  },
}));
jest.mock('@react-navigation/bottom-tabs', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type IScreenProps = { name: string; options: Record<string, unknown> };
  return {
    createBottomTabNavigator: () => ({
      Screen: () => null,
      Navigator: ({
        children,
        initialRouteName,
        tabBar,
      }: {
        children: React.ReactNode;
        initialRouteName: string;
        tabBar: (props: unknown) => React.ReactNode;
      }) => {
        const screens = React.Children.toArray(children).filter(
          React.isValidElement<IScreenProps>,
        );
        const routes = screens.map(({ props }) => ({
          key: props.name,
          name: props.name,
        }));
        return tabBar({
          state: {
            key: 'settings-tabs',
            routes,
            index: routes.findIndex(({ name }) => name === initialRouteName),
          },
          descriptors: Object.fromEntries(
            screens.map(({ props }) => [
              props.name,
              { options: props.options },
            ]),
          ),
          navigation: mockNavigation,
        });
      },
    }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: {
    children: import('react').ReactNode;
  }) => children,
}));
jest.mock('@onekeyhq/kit/src/components/AppUpdate', () => ({
  useAppUpdateInfo: () => ({ data: {} }),
  isShowAppUpdateUIWhenUpdating: () => false,
}));
jest.mock(
  '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet',
  () => ({
    useKeylessWalletExistsLocal: () => false,
  }),
);
jest.mock('@onekeyhq/kit/src/components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ isPrimeActive: false }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useBiometricAuthInfo', () => ({
  useBiometricAuthInfo: () => ({
    title: 'Biometrics',
    icon: 'FingerprintOutline',
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useHelpLink', () => ({
  useHelpLink: () => '',
}));
jest.mock('@onekeyhq/kit/src/hooks/useShowAddressBook', () => ({
  useShowAddressBook: () => jest.fn(),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
  usePasswordBiologyAuthInfoAtom: () => [{ isSupport: false }],
  usePasswordPersistAtom: () => [{ isPasswordSet: true }],
  usePasswordWebAuthInfoAtom: () => [{ isSupport: false }],
  useSettingsPersistAtom: () => [{}],
}));
jest.mock('../../../Onboardingv2/hooks/useCloudBackup', () => ({
  useCloudBackup: () => ({}),
}));
jest.mock('./exportLogs/showExportLogsDialog', () => ({}));
jest.mock('./SubSettings', () => ({
  SubSettings: () => null,
  SubSearchSettings: () => null,
}));
jest.mock('./SubSettingsLinkPanes', () => ({
  SubConnectionsSettings: () => null,
  SubNotificationsSettings: () => null,
}));
jest.mock('./useSearch', () => ({
  useSearch: () => ({ previousTabRoute: { current: undefined } }),
}));
jest.mock('./SearchView', () => ({ SearchView: () => null }));
jest.mock('./useSettingsPageStyle', () => ({
  useSettingsPageStyle: () => ({}),
}));
jest.mock('./CustomElement', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ...Object.fromEntries(
      [
        'AutoLockListItem',
        'BTCFreshAddressListItem',
        'BiologyAuthListItem',
        'ChangeOrSetPasswordListItem',
        'ClearAppCacheListItem',
        'ClearPendingTransactionsListItem',
        'CurrencyListItem',
        'DesktopBluetoothListItem',
        'HapticFeedbackListItem',
        'HardwareTransportTypeListItem',
        'LanguageListItem',
        'ListVersionItem',
        'MenuBarTrayListItem',
        'ResetAppListItem',
        'ResetPinListItem',
        'SplitViewListItem',
        'ThemeListItem',
        'TravelModeListItem',
        'UseGasAccountByDefaultListItem',
      ].map((name) => [name, () => null]),
    ),
    MobileSettingsVersionFooter: () =>
      React.createElement('div', { 'data-testid': 'setting-version' }),
    SocialButtonGroup: ({ hideChannels }: { hideChannels?: boolean }) =>
      React.createElement(
        'div',
        { 'data-testid': 'setting-version' },
        hideChannels
          ? null
          : React.createElement('div', {
              'data-testid': 'official-channels-and-support',
            }),
      ),
  };
});
jest.mock('./ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    MobileTabSettingsSection: ({ children }: { children: React.ReactNode }) =>
      children,
    TabSettingsInsetDivider: () => null,
    TabSettingsListGrid: () => null,
    TabSettingsListItem: ({
      title,
      onPress,
      testID,
    }: {
      title: string;
      onPress: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, 'data-testid': testID },
        title,
      ),
  };
});

const restrictedCategories = [
  { name: ESettingsTabNames.Backup, title: ETranslations.global_backup },
  { name: ESettingsTabNames.Network, title: ETranslations.global_networks },
  { name: ESettingsTabNames.AppData, title: ETranslations.app_data__title },
];

describe.each([
  { name: 'iPhone', isIOSPad: false, isAndroid: false, gtMd: false },
  { name: 'iPad', isIOSPad: true, isAndroid: false, gtMd: false },
  { name: 'wide Android', isIOSPad: false, isAndroid: true, gtMd: true },
])('Travel Mode settings on $name', ({ isIOSPad, isAndroid, gtMd }) => {
  const isTabNavigator = isIOSPad || gtMd;
  beforeEach(() => {
    jest.clearAllMocks();
    mockTravelMode = true;
    mockGtMd = gtMd;
    mockPlatform.isNativeIOSPad = isIOSPad;
    mockPlatform.isNativeIOS = !isAndroid;
    mockPlatform.isNativeAndroid = isAndroid;
  });

  it('shares the hidden and inert category policy across layouts', () => {
    const { result } = renderHook(() => useSettingsConfig());
    expect(
      result.current.find(
        (category) => category?.name === ESettingsTabNames.About,
      ),
    ).toEqual(expect.objectContaining({ isHidden: true }));
    for (const { name } of restrictedCategories) {
      expect(
        result.current.find((category) => category?.name === name),
      ).toEqual(expect.objectContaining({ ignorePress: true }));
    }
    const itemIds = result.current.flatMap(
      (category) => category?.configs.flat().map((item) => item?.id) ?? [],
    );
    expect(itemIds).not.toContain('manual-backup');
    expect(itemIds).not.toContain('address-book');
    expect(itemIds).not.toContain('add-network');
    expect(itemIds).not.toContain('custom-rpc');
  });

  it('hides About, search, official channels and Support', () => {
    const view = render(<SettingTab />);
    expect(view.queryByTestId(SettingTestIDs.aboutItem)).toBeNull();
    expect(view.queryByRole('textbox')).toBeNull();
    expect(view.queryByTestId('official-channels-and-support')).toBeNull();
    expect(view.getByTestId(SettingTestIDs.versionItem)).toBeTruthy();
  });

  it('keeps restricted rows visible without navigating or emitting tab events', async () => {
    const view = render(<SettingTab />);
    for (const { title } of restrictedCategories) {
      const button = view.getByRole('button', { name: title });
      expect(button.hasAttribute('disabled')).toBe(false);
      fireEvent.click(button);
    }
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.emit).not.toHaveBeenCalled();
    expect(mockCategoryOpened).not.toHaveBeenCalled();

    fireEvent.click(view.getByTestId(SettingTestIDs.securityItem));
    await waitFor(() => {
      expect(mockCategoryOpened).toHaveBeenCalledWith({
        category: ESettingsTabNames.Security,
        source: isTabNavigator ? 'sidebar' : 'mobileHome',
      });
    });
    expect(
      isTabNavigator ? mockNavigation.dispatch : mockNavigation.push,
    ).toHaveBeenCalledTimes(1);
  });

  it('restores categories, search and navigation in normal mode', async () => {
    mockTravelMode = false;
    const view = render(<SettingTab />);
    expect(view.getByTestId(SettingTestIDs.aboutItem)).toBeTruthy();
    expect(view.getByRole('textbox')).toBeTruthy();
    if (isTabNavigator) {
      expect(view.getByTestId('official-channels-and-support')).toBeTruthy();
    }
    for (const { title } of restrictedCategories) {
      fireEvent.click(view.getByRole('button', { name: title }));
    }
    await waitFor(() => {
      expect(
        isTabNavigator ? mockNavigation.dispatch : mockNavigation.push,
      ).toHaveBeenCalledTimes(3);
    });
  });
});
