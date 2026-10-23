/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import Browser from './Browser.native';

let mockRouteParams: { defaultTab?: ETranslations } | undefined;
let mockSelectedBrowserTab: ETranslations | undefined =
  ETranslations.global_market;
const mockSetSelectedBrowserTab = jest.fn();
const mockSwitchTab = jest.fn();
const mockTabs: { id: string }[] = [];
const mockActions = { setDisplayHomePage: jest.fn(), closeWebTab: jest.fn() };

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('expo-device', () => ({ deviceType: 1, DeviceType: { TABLET: 2 } }));
jest.mock('react-freeze', () => ({
  Freeze: ({ children }: PropsWithChildren) => children,
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: object) => styles },
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: ({ children }: PropsWithChildren) => <div>{children}</div> },
  useSharedValue: (value: number) => ({ value }),
}));
jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Page: Object.assign(Wrapper, { Body: Wrapper }),
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
    Icon: () => null,
    isLiquidGlassAvailable: () => true,
    useIsSplitView: () => false,
    useSplitMainView: () => false,
    useSplitSubView: () => false,
    useSafeAreaInsets: () => ({ top: 0 }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({ isNativeIOS: true }));
jest.mock('@onekeyhq/shared/src/modules/DualScreenInfo', () => ({
  isDualScreenDevice: () => false,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [
    { selectedBrowserTab: mockSelectedBrowserTab },
  ],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  serviceSetting: {
    setSelectedBrowserTab: (...args: unknown[]) => {
      mockSetSelectedBrowserTab(...args);
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => () => ({
  switchTab: (...args: unknown[]) => {
    mockSwitchTab(...args);
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => jest.fn());
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserTabActions: () => ({ current: mockActions }),
}));
jest.mock('@onekeyhq/kit/src/views/Discovery/hooks/useTakeScreenshot', () => ({
  useTakeScreenshot: () => jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    SwitchDiscoveryTabInNative: 'SwitchDiscoveryTabInNative',
  },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    discovery: { browser: { exploreTabView: jest.fn() } },
    market: { navigation: { discoveryDefaultTabParam: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/debug/debugUtils', () => ({
  useDebugComponentRemountLog: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: PropsWithChildren) => children,
}));
jest.mock('@onekeyhq/kit/src/components/LazyPageContainer', () => ({
  LazyPageContainer: ({ children }: PropsWithChildren) => children,
}));
jest.mock('@onekeyhq/kit/src/components/TabletHomeContainer', () => ({
  TabletHomeContainer: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/TabPageHeader/LegacyUniversalSearchInput',
  () => ({ LegacyUniversalSearchInput: () => null }),
);
jest.mock('../../../Earn/EarnHome', () => ({
  EarnHomeWithProvider: () => <span data-testid="earn-home" />,
}));
jest.mock('../../components/OuterTabPagerView', () => ({
  OuterTabPagerView: ({
    selectedHeaderTab,
    earnContent,
    browserContent,
  }: {
    selectedHeaderTab: ETranslations;
    earnContent: React.ReactNode;
    browserContent: React.ReactNode;
  }) => (
    <div data-testid="outer-pager" data-selected-tab={selectedHeaderTab}>
      {earnContent}
      {browserContent}
    </div>
  ),
}));
jest.mock('../../components/CustomHeaderTitle', () => () => null);
jest.mock('../../components/HandleData/HandleRebuildBrowserTabData', () => ({
  HandleRebuildBrowserData: () => null,
}));
jest.mock('../../components/HeaderRightToolBar', () => () => null);
jest.mock(
  '../../components/MobileBrowser/MobileBrowserBottomBar',
  () => () => null,
);
jest.mock(
  '../../components/MobileBrowser/MobileBrowserHeader',
  () => () => null,
);
jest.mock('../../hooks/useDAppNotifyChanges', () => ({
  useDAppNotifyChanges: jest.fn(),
}));
jest.mock('../../hooks/useMobileBottomBarAnimation', () => () => ({}));
jest.mock('../../hooks/useWebTabs', () => ({
  useWebTabs: () => ({ tabs: mockTabs }),
  useActiveTabId: () => ({}),
  useWebTabDataById: () => ({}),
  useDisplayHomePageFlag: () => ({ displayHomePage: true }),
}));
jest.mock('../../utils/explorerUtils', () => ({
  dismissWebviewKeyboard: jest.fn(),
}));
jest.mock('../../utils/screenshot', () => ({
  checkAndCreateFolder: jest.fn(),
}));
jest.mock('../../utils/tabBarUtils', () => ({
  showTabBar: jest.fn(),
  useNotifyTabBarDisplay: jest.fn(),
}));
jest.mock('../Dashboard/DashboardContent', () => () => (
  <span data-testid="browser-dashboard" />
));
jest.mock('./MobileBrowserContent', () => () => null);
jest.mock('./WithBrowserProvider', () => ({
  withBrowserProvider: (component: unknown) => component,
}));
jest.mock('./exploreTabUtils', () => ({
  getExploreTabName: () => 'browser',
  getExploreUniversalSearchTabRoute: () => undefined,
}));

describe('Browser.native Explore tab migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = undefined;
    mockSelectedBrowserTab = ETranslations.global_market;
  });

  it('normalizes persisted global_market tab to global_browser on mount', () => {
    const screen = render(<Browser />);
    expect(
      screen.getByTestId('outer-pager').getAttribute('data-selected-tab'),
    ).toBe(ETranslations.global_browser);
    expect(mockSetSelectedBrowserTab).toHaveBeenCalledWith(
      ETranslations.global_browser,
    );
  });

  it('redirects defaultTab=global_market route param to the standalone Market tab', () => {
    mockSelectedBrowserTab = ETranslations.global_earn;
    mockRouteParams = { defaultTab: ETranslations.global_market };
    render(<Browser />);
    expect(mockSwitchTab).toHaveBeenCalledWith(ETabRoutes.Market);
  });
});
