/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import Browser from './Browser.native';

let mockDisplayHome = true;
const mockHomeListeners = new Set<() => void>();
let mockHeaderLayout:
  | ((event: {
      nativeEvent: { target: number; layout: { height: number } };
    }) => void)
  | undefined;
let mockHeaderNode: HTMLDivElement | null = null;
let mockNextTag = 100;
const mockTags = new WeakMap<object, number>();
const mockMarketCommits: {
  externalTopOverlayTag?: number;
  externalTopOverlayHeight?: number;
}[] = [];
const mockTabs: { id: string }[] = [];
const mockActions = { setDisplayHomePage: jest.fn(), closeWebTab: jest.fn() };

jest.mock('@react-navigation/core', () => ({ useRoute: () => ({}) }));
jest.mock('expo-device', () => ({ deviceType: 1, DeviceType: { TABLET: 2 } }));
jest.mock('react-freeze', () => ({
  Freeze: ({ children }: PropsWithChildren) => children,
}));
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: object) => styles },
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
  findNodeHandle: (view: object | null) => (view ? mockTags.get(view) : null),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: ({ children }: PropsWithChildren) => <div>{children}</div> },
  useSharedValue: (value: number) => ({ value }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Wrapper = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Page: Object.assign(Wrapper, { Body: Wrapper }),
    Stack: Wrapper,
    XStack: Wrapper,
    Icon: () => null,
    YStack: React.forwardRef<
      HTMLDivElement,
      PropsWithChildren<{ onLayout?: typeof mockHeaderLayout }>
    >(({ children, onLayout }, ref) => {
      mockHeaderLayout = onLayout;
      const handleRef = React.useCallback(
        (node: HTMLDivElement | null) => {
          mockHeaderNode = node;
          if (node && !mockTags.has(node)) {
            mockNextTag += 1;
            mockTags.set(node, mockNextTag);
          }
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        },
        [ref],
      );
      return <div ref={handleRef}>{children}</div>;
    }),
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
  useSettingsPersistAtom: () => [{ selectedBrowserTab: 'global_market' }],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  serviceSetting: { setSelectedBrowserTab: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => jest.fn());
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserTabActions: () => ({ current: mockActions }),
}));
jest.mock('@onekeyhq/kit/src/views/Discovery/hooks/useTakeScreenshot', () => ({
  useTakeScreenshot: () => jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { browser: { exploreTabView: jest.fn() } } },
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
  EarnHomeWithProvider: () => null,
}));
jest.mock('../../../Market/MarketHomeV2/MarketHomeV2', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    MarketHomeWithProvider: (props: {
      externalTopOverlayTag?: number;
      externalTopOverlayHeight?: number;
    }) => {
      React.useLayoutEffect(() => {
        mockMarketCommits.push(props);
      });
      return null;
    },
  };
});
jest.mock('../../components/OuterTabPagerView', () => ({
  OuterTabPagerView: ({ marketContent }: { marketContent: React.ReactNode }) =>
    marketContent,
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
jest.mock('../../hooks/useDAppNotifyChanges', () => ({
  useDAppNotifyChanges: jest.fn(),
}));
jest.mock('../../hooks/useMobileBottomBarAnimation', () => () => ({}));
jest.mock('../../hooks/useWebTabs', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useWebTabs: () => ({ tabs: mockTabs }),
    useActiveTabId: () => ({}),
    useWebTabDataById: () => ({}),
    useDisplayHomePageFlag: () => ({
      displayHomePage: React.useSyncExternalStore(
        (listener) => {
          mockHomeListeners.add(listener);
          return () => {
            mockHomeListeners.delete(listener);
          };
        },
        () => mockDisplayHome,
      ),
    }),
  };
});
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
jest.mock('../Dashboard/DashboardContent', () => () => null);
jest.mock('./MobileBrowserContent', () => () => null);
jest.mock('./WithBrowserProvider', () => ({
  withBrowserProvider: (component: unknown) => component,
}));
jest.mock('./exploreTabUtils', () => ({
  getExploreTabName: () => 'market',
  getExploreUniversalSearchTabRoute: () => undefined,
}));

it('clears the mounted header identity before returning home and ignores old layout events', () => {
  mockDisplayHome = true;
  mockMarketCommits.length = 0;
  render(<Browser />);
  const oldTag = mockTags.get(mockHeaderNode as object) as number;
  const oldLayout = mockHeaderLayout;
  act(() =>
    oldLayout?.({ nativeEvent: { target: oldTag, layout: { height: 96 } } }),
  );
  expect(mockMarketCommits.at(-1)).toMatchObject({
    externalTopOverlayTag: oldTag,
    externalTopOverlayHeight: 96,
  });
  act(() => {
    mockDisplayHome = false;
    mockHomeListeners.forEach((listener) => listener());
  });
  mockMarketCommits.length = 0;
  act(() => {
    mockDisplayHome = true;
    mockHomeListeners.forEach((listener) => listener());
  });
  expect(mockMarketCommits[0]?.externalTopOverlayTag).toBeUndefined();
  const newTag = mockTags.get(mockHeaderNode as object) as number;
  expect(newTag).not.toBe(oldTag);
  act(() =>
    oldLayout?.({ nativeEvent: { target: oldTag, layout: { height: 300 } } }),
  );
  expect(mockMarketCommits.at(-1)?.externalTopOverlayTag).toBeUndefined();
  act(() =>
    mockHeaderLayout?.({
      nativeEvent: { target: newTag, layout: { height: 104 } },
    }),
  );
  expect(mockMarketCommits.at(-1)).toMatchObject({
    externalTopOverlayTag: newTag,
    externalTopOverlayHeight: 104,
  });
  act(() =>
    oldLayout?.({ nativeEvent: { target: oldTag, layout: { height: 300 } } }),
  );
  expect(mockMarketCommits.at(-1)).toMatchObject({
    externalTopOverlayTag: newTag,
    externalTopOverlayHeight: 104,
  });
});
