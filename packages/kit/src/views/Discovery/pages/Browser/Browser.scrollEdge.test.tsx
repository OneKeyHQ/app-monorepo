/** @jest-environment jsdom */
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import Browser from './Browser.native';

let mockRouteParams: { defaultTab?: ETranslations } | undefined;
let mockSelectedBrowserTab: ETranslations | undefined =
  ETranslations.global_market;
const mockSetSelectedBrowserTab = jest.fn();
const mockSwitchTab = jest.fn();
const mockTabs: { id: string }[] = [];
const mockActions = { setDisplayHomePage: jest.fn(), closeWebTab: jest.fn() };
let mockOuterTransitionChange: ((transitioning: boolean) => void) | undefined;
let mockVisiblePagesChange: ((pages: number[]) => void) | undefined;
let mockPageSelectedBySwipe: (() => void) | undefined;
const mockPlatformEnv = platformEnv;
let mockIsDualScreen = false;
let mockIsSplitSubView = false;
let mockIsSplitMainView = false;
let mockIsSpanning = false;
let mockSetSpanning: ((value: boolean) => void) | undefined;
let mockDisplayHomePage = true;
const mockWebViewMount = jest.fn();
const mockWebViewUnmount = jest.fn();

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
    useIsSplitView: () => {
      const [spanning, setSpanning] = useState(mockIsSpanning);
      mockSetSpanning = setSpanning;
      return spanning;
    },
    useSplitMainView: () => mockIsSplitMainView,
    useSplitSubView: () => mockIsSplitSubView,
    useSafeAreaInsets: () => ({ top: 0 }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNativeIOS: true,
  isNativeAndroid: false,
}));
jest.mock('@onekeyhq/shared/src/modules/DualScreenInfo', () => ({
  isDualScreenDevice: () => mockIsDualScreen,
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
  TabletHomeContainer: () => <span data-testid="tablet-placeholder" />,
}));
jest.mock('@onekeyhq/kit/src/components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/TabPageHeader/LegacyUniversalSearchInput',
  () => ({ LegacyUniversalSearchInput: () => null }),
);
jest.mock('../../../Earn/EarnHome', () => ({
  EarnHomeWithProvider: ({
    showContent,
    bannerAutoPlayEnabled,
  }: {
    showContent?: boolean;
    bannerAutoPlayEnabled?: boolean;
  }) => (
    <span
      data-testid="earn-home"
      data-show-content={String(showContent)}
      data-banner-autoplay={String(bannerAutoPlayEnabled)}
    />
  ),
}));
jest.mock('../../components/OuterTabPagerView', () => ({
  OuterTabPagerView: ({
    selectedHeaderTab,
    earnContent,
    browserContent,
    onTransitioningChange,
    onVisiblePagesChange,
    showDiscoveryPage,
    onPageSelectedBySwipe,
  }: {
    selectedHeaderTab: ETranslations;
    showDiscoveryPage: boolean;
    earnContent: React.ReactNode;
    browserContent: React.ReactNode;
    onTransitioningChange?: (transitioning: boolean) => void;
    onVisiblePagesChange?: (pages: number[]) => void;
    onPageSelectedBySwipe?: () => void;
  }) => {
    mockOuterTransitionChange = onTransitioningChange;
    mockVisiblePagesChange = onVisiblePagesChange;
    mockPageSelectedBySwipe = onPageSelectedBySwipe;
    return (
      <div
        data-testid="outer-pager"
        data-selected-tab={selectedHeaderTab}
        data-scroll-enabled={String(showDiscoveryPage)}
      >
        {earnContent}
        {browserContent}
      </div>
    );
  },
}));
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
jest.mock('../../hooks/useMobileBrowserChromeAnimation', () => () => ({
  expandBrowserChrome: jest.fn(),
}));
jest.mock('../../hooks/useWebTabs', () => ({
  useWebTabs: () => ({ tabs: mockTabs }),
  useActiveTabId: () => ({}),
  useWebTabDataById: () => ({}),
  useDisplayHomePageFlag: () => ({ displayHomePage: mockDisplayHomePage }),
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
jest.mock(
  './MobileBrowserContent',
  () =>
    function MockMobileBrowserContent() {
      useEffect(() => {
        mockWebViewMount();
        return () => {
          mockWebViewUnmount();
        };
      }, []);
      return <span data-testid="browser-web-page" />;
    },
);
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
    mockPlatformEnv.isNativeIOS = true;
    mockPlatformEnv.isNativeAndroid = false;
    mockIsDualScreen = false;
    mockIsSplitSubView = false;
    mockDisplayHomePage = true;
    mockIsSplitMainView = false;
    mockIsSpanning = false;
    mockTabs.length = 0;
  });

  it.each([
    ['folded detail pane', false, true, false, true],
    ['unfolded main pane', true, false, true, true],
    ['folded hidden main pane', true, false, false, false],
    ['single-pane foldable', false, false, false, true],
  ])(
    'uses the native pager in the %s',
    (_name, main, detail, spanning, showsEarn) => {
      mockPlatformEnv.isNativeIOS = false;
      mockPlatformEnv.isNativeAndroid = true;
      mockIsDualScreen = true;
      mockIsSplitMainView = main;
      mockIsSplitSubView = detail;
      mockIsSpanning = spanning;
      mockSelectedBrowserTab = ETranslations.global_browser;
      const screen = render(<Browser />);
      expect(screen.getByTestId('outer-pager')).toBeTruthy();
      expect(Boolean(screen.queryByTestId('earn-home'))).toBe(showsEarn);
      expect(mockSetSelectedBrowserTab).not.toHaveBeenCalled();
    },
  );

  it('keeps the unfolded home detail pane as a placeholder', () => {
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isNativeAndroid = true;
    mockIsDualScreen = true;
    mockIsSplitSubView = true;
    mockIsSpanning = true;
    mockSelectedBrowserTab = ETranslations.global_browser;
    const screen = render(<Browser />);
    expect(screen.getByTestId('tablet-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('outer-pager')).toBeNull();
  });

  it('keeps the detail web page outside the pager across folding', () => {
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isNativeAndroid = true;
    mockIsDualScreen = true;
    mockIsSplitSubView = true;
    mockDisplayHomePage = false;
    mockSelectedBrowserTab = ETranslations.global_browser;
    mockTabs.push({ id: 'test-tab' });
    const screen = render(<Browser />);
    expect(
      screen.getByTestId('outer-pager').getAttribute('data-scroll-enabled'),
    ).toBe('false');
    expect(
      screen
        .getByTestId('outer-pager')
        .contains(screen.getByTestId('browser-web-page')),
    ).toBe(false);
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    act(() => mockSetSpanning?.(true));
    expect(screen.getByTestId('outer-pager')).toBeTruthy();
    expect(screen.queryByTestId('earn-home')).toBeNull();
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    expect(mockWebViewUnmount).not.toHaveBeenCalled();
    act(() => mockSetSpanning?.(false));
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    expect(mockWebViewUnmount).not.toHaveBeenCalled();
  });

  it('does not mount web pages in the unfolded main pane', () => {
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isNativeAndroid = true;
    mockIsDualScreen = true;
    mockIsSplitMainView = true;
    mockIsSpanning = true;
    mockDisplayHomePage = false;
    mockSelectedBrowserTab = ETranslations.global_browser;
    mockTabs.push({ id: 'test-tab' });
    const screen = render(<Browser />);
    expect(
      screen.getByTestId('outer-pager').getAttribute('data-scroll-enabled'),
    ).toBe('true');
    expect(screen.queryByTestId('browser-web-page')).toBeNull();
    expect(mockWebViewMount).not.toHaveBeenCalled();
  });

  it('retains the legacy pager-free layout on iOS split view', () => {
    mockIsSplitSubView = true;
    mockSelectedBrowserTab = ETranslations.global_browser;
    const screen = render(<Browser />);
    expect(screen.queryByTestId('outer-pager')).toBeNull();
    expect(screen.getByTestId('browser-dashboard')).toBeTruthy();
  });

  it('collapses the detail web page when the main pane swipes to DeFi', () => {
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isNativeAndroid = true;
    mockIsDualScreen = true;
    mockIsSplitMainView = true;
    mockIsSpanning = true;
    mockDisplayHomePage = false;
    mockSelectedBrowserTab = ETranslations.global_browser;
    render(<Browser />);
    act(() => mockPageSelectedBySwipe?.());
    expect(mockActions.setDisplayHomePage).toHaveBeenCalledWith(true);
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

  it('pauses the Earn banner during a swipe and restores permission when it settles', () => {
    mockSelectedBrowserTab = ETranslations.global_earn;
    const screen = render(<Browser />);
    act(() => mockVisiblePagesChange?.([0]));
    expect(
      screen.getByTestId('earn-home').getAttribute('data-banner-autoplay'),
    ).toBe('true');
    act(() => mockOuterTransitionChange?.(true));
    expect(
      screen.getByTestId('earn-home').getAttribute('data-banner-autoplay'),
    ).toBe('false');
    act(() => mockOuterTransitionChange?.(false));
    expect(
      screen.getByTestId('earn-home').getAttribute('data-banner-autoplay'),
    ).toBe('true');
    act(() => mockOuterTransitionChange?.(true));
    act(() => {
      mockVisiblePagesChange?.([1]);
      mockOuterTransitionChange?.(false);
    });
    // The persisted selected tab can still lag behind the pager's actual page.
    expect(
      screen.getByTestId('earn-home').getAttribute('data-banner-autoplay'),
    ).toBe('false');
    screen.unmount();
    mockSelectedBrowserTab = ETranslations.global_browser;
    const browserScreen = render(<Browser />);
    expect(
      browserScreen.getByTestId('earn-home').getAttribute('data-show-content'),
    ).toBe('false');
  });
});
