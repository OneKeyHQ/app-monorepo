import * as React from 'react';
import { createRef } from 'react';

import { act, render } from '@testing-library/react-native';
import * as jsxRuntime from 'react/jsx-runtime';

import type { ITabContainerRef } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { SpotlightScrollStateContext } from '../../../components/Spotlight/SpotlightScrollStateContext';

import { HomeNativePager } from './HomeNativePager.native';

import type { IHomeHeaderContainerProps } from './HomeHeaderContainer';
import type { ISpotlightScrollState } from '../../../components/Spotlight/SpotlightScrollStateContext';
import type { LayoutChangeEvent } from 'react-native';

let mockRenderParentHeader = false;
let mockMountedPageLifecycle = false;
let mockReadyWithMapping = false;
let mockParentComponentLookup: ((key: PropertyKey) => unknown) | undefined;
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockHeaderHeightCommits: number[] = [];
const mockNativeEvents: {
  onMountedPagesChanged?: (event: { pageKeys: readonly string[] }) => void;
  onCollapsibleStateChanged?: (event: {
    nativeEvent: {
      position: number;
      pageKey: string;
      headerOffset: number;
      headerSettledAtTop: boolean;
    };
  }) => void;
  headerHeight?: number;
  header?: React.ReactElement<{ onLayout: (event: LayoutChangeEvent) => void }>;
  onPageScroll?: (event: {
    nativeEvent: { position: number; offset: number };
  }) => void;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
  onPageScrollStateChanged?: (event: {
    nativeEvent: { pageScrollState: 'idle' | 'dragging' | 'settling' };
  }) => void;
} = {};

jest.mock('react-native', () => {
  const native =
    jest.requireActual<typeof import('react-native')>('react-native');
  const react = jest.requireActual<typeof import('react')>('react');
  // The root Jest config also discovers the CLI shim, which has no View host.
  const View = ({
    children,
    ...props
  }: React.ComponentPropsWithRef<typeof native.View>) =>
    react.createElement('View', props, children);
  return new Proxy(native, {
    get: (target, key): unknown =>
      key === 'View' ? View : Reflect.get(target, key),
  });
});

jest.mock(
  '@onekeyhq/components',
  () =>
    new Proxy(
      {
        useTheme: () => ({ bgApp: { val: '#ffffff' } }),
      },
      {
        get: (target, key): unknown =>
          mockParentComponentLookup?.(key) ?? Reflect.get(target, key),
      },
    ),
);
jest.mock('./perpsChainTrace', () => ({ debugPerpsChain: jest.fn() }));
jest.mock('react-native-pager-view', () => ({
  CollapsiblePagerView: ({
    ref,
    ...events
  }: {
    ref: React.Ref<unknown>;
    children?: React.ReactNode;
  } & typeof mockNativeEvents) => {
    Object.assign(mockNativeEvents, events);
    const { useImperativeHandle, useLayoutEffect, useRef } =
      jest.requireActual<typeof import('react')>('react');
    const mountSignature = useRef('');
    useLayoutEffect(() => {
      if (events.headerHeight !== undefined) {
        mockHeaderHeightCommits.push(events.headerHeight);
      }
      if (mockMountedPageLifecycle) {
        const pageKeys = React.Children.toArray(events.children).map((child) =>
          String((child as React.ReactElement).key),
        );
        const signature = JSON.stringify(pageKeys);
        if (signature !== mountSignature.current) {
          mountSignature.current = signature;
          events.onMountedPagesChanged?.({ pageKeys });
          if (mockReadyWithMapping)
            events.onCollapsibleStateChanged?.({
              nativeEvent: {
                position: 0,
                pageKey: pageKeys[0],
                headerOffset: 0,
                headerSettledAtTop: true,
              },
            });
        }
      }
    });
    useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      setPageWithoutAnimation: mockSetPageWithoutAnimation,
    }));
    return mockRenderParentHeader ? events.header : null;
  },
}));
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual<typeof import('react')>('react');
  return { useSharedValue: (value: unknown) => useRef({ value }).current };
});

const headerTestProps = {
  tabs: [{ id: EHomeWalletTab.Portfolio, name: 'Spot', component: null }],
  renderHeader: () => null,
  renderTabBar: () => null,
  onTabChange: jest.fn(),
};
const headerLayoutEvent = (height: number): LayoutChangeEvent =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
  }) as LayoutChangeEvent;

it.each([292, 236, undefined])(
  'starts with header hint %s or the default height',
  (headerHeightHint) => {
    render(
      <HomeNativePager
        {...headerTestProps}
        headerHeightHint={headerHeightHint}
      />,
    );
    expect(mockNativeEvents.headerHeight).toBe(headerHeightHint ?? 182);
  },
);

it('corrects the hint with layout and retains measurement for a stable hint', () => {
  mockHeaderHeightCommits.length = 0;
  const { rerender } = render(
    <HomeNativePager {...headerTestProps} headerHeightHint={292} />,
  );
  act(() => mockNativeEvents.header?.props.onLayout(headerLayoutEvent(301.2)));
  expect(mockNativeEvents.headerHeight).toBe(302);
  rerender(<HomeNativePager {...headerTestProps} headerHeightHint={292} />);
  expect(mockNativeEvents.headerHeight).toBe(302);

  rerender(<HomeNativePager {...headerTestProps} headerHeightHint={240} />);
  expect(mockNativeEvents.headerHeight).toBe(240);
  act(() => mockNativeEvents.header?.props.onLayout(headerLayoutEvent(248.5)));
  expect(mockNativeEvents.headerHeight).toBe(249);
  rerender(<HomeNativePager {...headerTestProps} />);
  expect(mockNativeEvents.headerHeight).toBe(182);
  expect(mockHeaderHeightCommits).toEqual([292, 302, 302, 240, 249, 182]);
});

it('resets A -> B -> A without a B measurement and ignores stale layouts', () => {
  mockHeaderHeightCommits.length = 0;
  const { rerender } = render(
    <HomeNativePager {...headerTestProps} headerHeightHint={292} />,
  );
  const oldAOnLayout = mockNativeEvents.header?.props.onLayout;
  act(() => oldAOnLayout?.(headerLayoutEvent(310)));
  expect(mockNativeEvents.headerHeight).toBe(310);

  rerender(<HomeNativePager {...headerTestProps} headerHeightHint={240} />);
  expect(mockNativeEvents.headerHeight).toBe(240);
  const oldBOnLayout = mockNativeEvents.header?.props.onLayout;
  act(() => oldAOnLayout?.(headerLayoutEvent(320)));
  expect(mockNativeEvents.headerHeight).toBe(240);

  rerender(<HomeNativePager {...headerTestProps} headerHeightHint={292} />);
  expect(mockNativeEvents.headerHeight).toBe(292);
  act(() => {
    oldAOnLayout?.(headerLayoutEvent(320));
    oldBOnLayout?.(headerLayoutEvent(250));
  });
  expect(mockNativeEvents.headerHeight).toBe(292);
  act(() => mockNativeEvents.header?.props.onLayout(headerLayoutEvent(304)));
  expect(mockNativeEvents.headerHeight).toBe(304);
  expect(mockHeaderHeightCommits).toEqual([292, 310, 240, 292, 304]);
});

it.each([
  ['Spot', 'Perps', 1, true],
  ['Spot', 'History', 3, false],
  ['History', 'NFT', 2, true],
  ['History', 'Spot', 0, false],
] as const)(
  'switches from %s to %s with the default distance policy',
  (initialTabName, targetName, targetIndex, animated) => {
    mockSetPage.mockClear();
    mockSetPageWithoutAnimation.mockClear();
    const ref = createRef<ITabContainerRef>();
    render(
      <HomeNativePager
        ref={ref}
        tabs={[
          { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null },
          { id: EHomeWalletTab.Perps, name: 'Perps', component: null },
          { id: EHomeWalletTab.NFT, name: 'NFT', component: null },
          { id: EHomeWalletTab.History, name: 'History', component: null },
        ]}
        initialTabName={initialTabName}
        renderHeader={() => null}
        renderTabBar={() => null}
        onTabChange={jest.fn()}
      />,
    );
    act(() => ref.current?.jumpToTab(targetName));
    expect(
      animated ? mockSetPage : mockSetPageWithoutAnimation,
    ).toHaveBeenCalledWith(targetIndex);
    expect(
      animated ? mockSetPageWithoutAnimation : mockSetPage,
    ).not.toHaveBeenCalled();
  },
);

it.each([
  ['Spot', 0, EHomeWalletTab.Perps, 0.2],
  ['Perps', 1, EHomeWalletTab.Portfolio, 0.8],
] as const)(
  'prepares a swipe from %s without changing focus when cancelled',
  (initialTabName, initialIndex, targetId, progress) => {
    const ref = createRef<ITabContainerRef>();
    const onTabPrepare = jest.fn();
    const onTabChange = jest.fn();
    render(
      <HomeNativePager
        ref={ref}
        tabs={[
          { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null },
          { id: EHomeWalletTab.Perps, name: 'Perps', component: null },
        ]}
        initialTabName={initialTabName}
        renderHeader={() => null}
        renderTabBar={() => null}
        onTabChange={onTabChange}
        onTabPrepare={onTabPrepare}
      />,
    );
    const scroll = () =>
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: 0, offset: progress },
      });
    act(scroll);
    expect(onTabPrepare).not.toHaveBeenCalled();
    act(() => {
      mockNativeEvents.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'dragging' },
      });
      scroll();
      scroll();
    });
    expect(onTabPrepare).toHaveBeenCalledTimes(1);
    expect(onTabPrepare).toHaveBeenCalledWith({ tabId: targetId });
    expect(ref.current?.getCurrentIndex()).toBe(initialIndex);
    expect(ref.current?.getFocusedTab()).toBe(initialTabName);
    expect(onTabChange).not.toHaveBeenCalled();
    act(() => {
      mockNativeEvents.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'idle' },
      });
      scroll();
    });
    expect(onTabPrepare).toHaveBeenCalledTimes(1);
    expect(ref.current?.getFocusedTab()).toBe(initialTabName);
    expect(onTabChange).not.toHaveBeenCalled();
    const targetIndex = initialIndex === 0 ? 1 : 0;
    act(() => {
      mockNativeEvents.onPageSelected?.({
        nativeEvent: { position: targetIndex },
      });
    });
    expect(ref.current?.getCurrentIndex()).toBe(targetIndex);
    expect(onTabChange).toHaveBeenCalledTimes(1);
  },
);

it('normalizes a removed selected key and does not reactivate it when restored', () => {
  const onTabChange = jest.fn();
  let focusedName = '';
  const spot = { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null };
  const nft = { id: EHomeWalletTab.NFT, name: 'NFT', component: null };
  const common = {
    initialTabName: 'NFT',
    renderHeader: () => null,
    renderTabBar: ({ focusedTab }: { focusedTab: { value: string } }) => {
      focusedName = focusedTab.value;
      return null;
    },
    onTabChange,
  };
  const { rerender } = render(
    <HomeNativePager {...common} tabs={[spot, nft]} />,
  );
  rerender(<HomeNativePager {...common} tabs={[spot]} />);
  expect(onTabChange).toHaveBeenCalledTimes(1);
  expect(onTabChange).toHaveBeenLastCalledWith({ tabName: 'Spot' });
  rerender(<HomeNativePager {...common} tabs={[spot, nft]} />);
  expect(onTabChange).toHaveBeenCalledTimes(1);
  expect(focusedName).toBe('Spot');
});

it('ignores queued scroll progress after restoring a reordered tab', () => {
  const spot = { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null };
  const perps = { id: EHomeWalletTab.Perps, name: 'Perps', component: null };
  const history = {
    id: EHomeWalletTab.History,
    name: 'History',
    component: null,
  };
  let indexDecimal: { value: number } | undefined;
  const common = {
    initialTabName: 'History',
    renderHeader: () => null,
    renderTabBar: (props: { indexDecimal: { value: number } }) => {
      indexDecimal = props.indexDecimal;
      return null;
    },
    onTabChange: jest.fn(),
  };
  const { rerender } = render(
    <HomeNativePager {...common} tabs={[spot, perps, history]} />,
  );
  rerender(<HomeNativePager {...common} tabs={[spot, history]} />);
  expect(indexDecimal?.value).toBe(1);
  act(() => {
    mockNativeEvents.onPageScroll?.({
      nativeEvent: { position: 2, offset: 0 },
    });
  });
  expect(indexDecimal?.value).toBe(1);
  act(() => {
    mockNativeEvents.onPageScrollStateChanged?.({
      nativeEvent: { pageScrollState: 'dragging' },
    });
    mockNativeEvents.onPageScroll?.({
      nativeEvent: { position: 0, offset: 0.5 },
    });
  });
  expect(indexDecimal?.value).toBe(0.5);
});

it.each([
  ['Spot', 'History', 0, 3],
  ['History', 'Spot', 3, 0],
] as const)(
  'keeps %s to %s immediate selection aligned without a native scroll event',
  (initialTabName, targetName, initialIndex, targetIndex) => {
    const ref = createRef<ITabContainerRef>();
    let tabBarState:
      | { indexDecimal: { value: number }; focusedTab: { value: string } }
      | undefined;
    render(
      <HomeNativePager
        ref={ref}
        tabs={[
          { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null },
          { id: EHomeWalletTab.Perps, name: 'Perps', component: null },
          { id: EHomeWalletTab.NFT, name: 'NFT', component: null },
          { id: EHomeWalletTab.History, name: 'History', component: null },
        ]}
        initialTabName={initialTabName}
        renderHeader={() => null}
        renderTabBar={(props) => {
          tabBarState = props;
          return null;
        }}
        onTabChange={jest.fn()}
      />,
    );
    act(() => ref.current?.jumpToTab(targetName));
    expect(tabBarState?.indexDecimal.value).toBe(targetIndex);
    act(() => {
      mockNativeEvents.onPageSelected?.({
        nativeEvent: { position: targetIndex },
      });
      // A queued progress event from the previous page must not undo the jump.
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: initialIndex, offset: 0 },
      });
    });
    expect(tabBarState?.indexDecimal.value).toBe(targetIndex);
    expect(tabBarState?.focusedTab.value).toBe(targetName);
    expect(ref.current?.getCurrentIndex()).toBe(targetIndex);

    act(() => {
      mockNativeEvents.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'dragging' },
      });
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: 1, offset: 0.4 },
      });
    });
    expect(tabBarState?.indexDecimal.value).toBe(1.4);

    act(() => ref.current?.jumpToTab(initialTabName));
    act(() => {
      mockNativeEvents.onPageSelected?.({
        nativeEvent: { position: initialIndex },
      });
    });
    const adjacentIndex = initialIndex === 0 ? 1 : 2;
    act(() => ref.current?.setIndex(adjacentIndex));
    expect(tabBarState?.indexDecimal.value).toBe(initialIndex);
    act(() => {
      mockNativeEvents.onPageScroll?.({
        nativeEvent: { position: 1, offset: 0.6 },
      });
    });
    expect(tabBarState?.indexDecimal.value).toBe(1.6);
  },
);

describe('HomePageView complete header authority', () => {
  let HomePage: typeof import('./HomePageView').HomePageView;
  const callbacks: IHomeHeaderContainerProps = {};
  const measurements: ((
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void)[] = [];
  let onFullLayout: ((event: LayoutChangeEvent) => void) | undefined;
  const cache = new Map<string, number>([['B', 182]]);
  const noop = () => undefined;
  const host = (name: string) => {
    const Stub = ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(name, props, children);
    Stub.displayName = name;
    return Stub;
  };

  const awareScrollView = host('AwareScrollView');
  const parentPlatform = {
    isNative: true,
    isNativeAndroid: true,
    isNativeIOS: false,
  };
  let walletBackedUp = true;
  let refreshModule: typeof import('../components/PullToRefresh');

  beforeAll(() => {
    // Keep React shared with the renderer while isolating the parent module's
    // business providers. Header callbacks and the native pager stay real.
    jest.isolateModules(() => {
      jest.doMock('react', () => React);
      jest.doMock('react/jsx-runtime', () => jsxRuntime);
      const generic = new Proxy(
        {},
        { get: (_target, key) => host(String(key)) },
      );
      const components = new Proxy(
        {
          Stack: ({
            children,
            ...props
          }: React.ComponentPropsWithRef<
            typeof import('react-native').View
          >) => {
            if (props.ref && props.onLayout) onFullLayout = props.onLayout;
            return React.createElement('View', props, children);
          },
          Page: Object.assign(host('Page'), {
            Body: host('Page.Body'),
            Container: host('Page.Container'),
          }),
          Keyboard: { AwareScrollView: awareScrollView },
          Icon: Object.assign(host('Icon'), { prefetch: noop }),
          useScrollContentTabBarOffset: () => 48,
          useMedia: () => ({ md: true }),
          useTheme: () => ({ bgApp: { val: '#ffffff' } }),
          useFocusedTab: () => 'spot',
          useTabsScrollToTop: () => noop,
        },
        {
          get: (target, key): unknown =>
            Reflect.get(target, key) ?? Reflect.get(generic, key),
        },
      );
      mockParentComponentLookup = (key): unknown =>
        Reflect.get(components, key);
      const mocks: Record<string, unknown> = {
        '@onekeyhq/components': components,
        '@react-navigation/core': { useFocusEffect: noop },
        'react-intl': {
          useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
        },
        '@onekeyhq/kit/src/hooks/useTabContainerWidth': {
          useTabContainerWidth: () => 400,
        },
        '@onekeyhq/shared/src/config/presetNetworks': {
          getNetworksSupportBulkRevokeApproval: () => ({}),
        },
        '@onekeyhq/shared/src/consts/dbConsts': {
          WALLET_TYPE_HD: 'hd',
          WALLET_TYPE_WATCHING: 'watch',
        },
        '@onekeyhq/shared/src/platformEnv': {
          default: parentPlatform,
          __esModule: true,
        },
        '@onekeyhq/shared/src/locale': {
          ETranslations: new Proxy({}, { get: (_target, key) => key }),
        },
        '@onekeyhq/shared/types/wallet': { EHomeWalletTab },
        '@onekeyhq/shared/src/eventBus/appEventBus': {
          EAppEventBusNames: {},
          appEventBus: { on: noop, off: noop },
        },
        '@onekeyhq/shared/src/storage/uiSnapshotCaches': {
          homeHeaderLayoutCache: {
            get: (key: string) =>
              cache.has(key) ? { data: cache.get(key) } : undefined,
            set: (key: string, value: number) => cache.set(key, value),
          },
        },
        '@onekeyhq/shared/src/travelMode': {
          travelModeManager: {
            getRuntimeEnvironmentSync: () => ({ profile: { kind: 'normal' } }),
          },
        },
        '@onekeyhq/shared/src/utils/accountUtils': {
          default: {
            hasNoUsableWallet: () => false,
            isWalletDeprecatedOrMocked: () => false,
          },
          __esModule: true,
        },
        '../../../hooks/useAppNavigation': {
          default: () => ({}),
          __esModule: true,
        },
        '../../../hooks/usePromiseResult': {
          usePromiseResult: () => ({ run: noop }),
        },
        '../../../hooks/useRunAfterTokensDone': {
          runAfterTokensDone: () => noop,
        },
        '../../../hooks/useShortcutsOnRouteFocused': {
          useShortcutsOnRouteFocused: noop,
        },
        '../../../states/jotai/contexts/accountSelector': {
          useActiveAccount: () => ({
            activeAccount: {
              ready: true,
              wallet: { id: 'test-hd', type: 'hd', backuped: walletBackedUp },
              account: { id: 'test-account' },
              network: { id: 'test-network' },
            },
          }),
          useAccountSelectorStorageInitDoneAtom: () => [true],
          useIsAccountSelectorActiveAccountInitDone: () => true,
        },
        '../../../states/jotai/contexts/accountOverview': {
          buildOverviewOwnerKey: () => 'test-owner',
          useAccountOverviewActions: () => ({
            current: { updateApprovalsInfo: noop },
          }),
        },
        '../../../components/AccountSelector/hooks/useUnifiedNetworkSelectorTrigger':
          { useUnifiedNetworkSelectorTrigger: () => ({}) },
        '../hooks/useHomeWalletTabSupport': {
          useHomeWalletTabSupport: () => ({}),
        },
        '../components/HomeStickyHeaderContext': {
          HomeStickyHeaderContext: React.createContext({}),
        },
        './homePageNoWalletContent': {
          isWalletListResolvedNoWallet: () => false,
          shouldShowNoWalletContent: () => false,
        },
        './homeTabFreeze': {
          useHomeTabFreeze: () => false,
          useHomeTabOwnerThaw: () => false,
          isHomeTabActive: () => true,
        },
        './HomeHeaderContainer': {
          HomeHeaderContainer: (props: IHomeHeaderContainerProps) => {
            Object.assign(callbacks, props);
            return null;
          },
        },
        './HomeNativePager': { HomeNativePager },
      };
      const boundaries = [
        '@react-navigation/core',
        'axios',
        'react-intl',
        '@onekeyhq/components',
        '@onekeyhq/components/src/composite/Tabs/TabBar',
        '@onekeyhq/kit/src/hooks/useTabContainerWidth',
        '@onekeyhq/shared/src/config/presetNetworks',
        '@onekeyhq/shared/src/consts/dbConsts',
        '@onekeyhq/shared/src/eventBus/appEventBus',
        '@onekeyhq/shared/src/locale',
        '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource',
        '@onekeyhq/shared/src/platformEnv',
        '@onekeyhq/shared/src/routes',
        '@onekeyhq/shared/src/shortcuts/shortcuts.enum',
        '@onekeyhq/shared/src/storage/uiSnapshotCaches',
        '@onekeyhq/shared/src/travelMode',
        '@onekeyhq/shared/src/utils/accountUtils',
        '@onekeyhq/shared/src/utils/networkUtils',
        '@onekeyhq/shared/types/wallet',
        '../../../background/instance/backgroundApiProxy',
        '../../../components/AccountSelector/hooks/useUnifiedNetworkSelectorTrigger',
        '../../../components/Empty',
        '../../../components/NetworkAlert',
        '../../../components/NotificationEnableAlert',
        '../../../components/NotificationPermissionRecoveryAlert',
        '../../../components/TabPageHeader',
        '../../../components/WatchOnlyAlert',
        '../../../components/WebDapp/WebDappEmptyView',
        '../../../hooks/useAppNavigation',
        '../../../hooks/usePromiseResult',
        '../../../hooks/useRunAfterTokensDone',
        '../../../hooks/useShortcutsOnRouteFocused',
        '../../../states/jotai/contexts/accountOverview',
        '../../../states/jotai/contexts/accountSelector',
        '../../../utils/deferHeavyWork',
        '../../Staking/components/ProtocolDetails/NetworkUnsupportedWarning',
        '../components/HomeHeaderGesture',
        '../components/HomeStickyHeaderContext',
        '../components/HomeSupportedWallet',
        '../components/NotBakcedUp',
        '../components/PullToRefresh',
        '../hooks/useHomeWalletTabSupport',
        '../testIDs',
        './DeFiContainer',
        './HomeHeaderContainer',
        './HomeNativePager',
        './homePageContentMaxWidth',
        './homePageNoWalletContent',
        './homeTabFreeze',
        './NFTListContainer',
        './perpsChainTrace',
        './PortfolioContainer',
        './TabHeaderSettings',
        './TxHistoryContainer',
        './WalletContentWithAuth',
      ];
      for (const id of boundaries)
        jest.doMock(
          id,
          () =>
            mocks[id] ??
            new Proxy(
              { __esModule: true, default: host(id) },
              {
                get: (target, key): unknown =>
                  Reflect.get(target, key) ?? Reflect.get(generic, key),
              },
            ),
        );
      jest.doMock('../components/PullToRefresh', () => {
        refreshModule = jest.requireActual<
          typeof import('../components/PullToRefresh')
        >('../components/PullToRefresh');
        return refreshModule;
      });
      HomePage =
        jest.requireActual<typeof import('./HomePageView')>(
          './HomePageView',
        ).HomePageView;
    });
  });
  beforeEach(() => {
    mockRenderParentHeader = true;
    Object.assign(parentPlatform, {
      isNative: true,
      isNativeAndroid: true,
      isNativeIOS: false,
    });
    walletBackedUp = true;
    measurements.length = 0;
    onFullLayout = undefined;
  });
  afterEach(() => {
    mockRenderParentHeader = false;
    mockMountedPageLifecycle = false;
    mockReadyWithMapping = false;
  });
  const renderParent = () =>
    render(
      React.createElement(HomePage, {
        sceneName: EAccountSelectorSceneName.home,
      }),
      {
        createNodeMock: () => ({
          measure: (callback: (typeof measurements)[number]) =>
            measurements.push(callback),
        }),
      },
    );

  it.each(['ios', 'android', 'web'] as const)(
    'uses the native refresh control for an unbacked wallet on %s',
    (platform) => {
      Object.assign(parentPlatform, {
        isNative: platform !== 'web',
        isNativeAndroid: platform === 'android',
        isNativeIOS: platform === 'ios',
      });
      walletBackedUp = false;
      const screen = renderParent();
      const scroll = screen.UNSAFE_getByType(awareScrollView);
      expect(scroll.props.nestedScrollEnabled).toBe(platform === 'android');
      if (platform === 'web') {
        expect(scroll.props.refreshControl).toBeUndefined();
      } else {
        expect(scroll.props.refreshControl).toBeDefined();
        expect(scroll.props.refreshControl.type).toBe(
          refreshModule.PullToRefresh,
        );
        expect(scroll.props.refreshControl.props.onRefresh).toBe(
          refreshModule.onHomePageRefresh,
        );
      }
    },
  );

  it.each(['ios', 'android'] as const)(
    'keeps the native pager for a backed wallet on %s',
    (platform) => {
      Object.assign(parentPlatform, {
        isNative: true,
        isNativeAndroid: platform === 'android',
        isNativeIOS: platform === 'ios',
      });
      const screen = renderParent();
      expect(screen.UNSAFE_queryByType(awareScrollView)).toBeNull();
      expect(screen.UNSAFE_getByType(HomeNativePager)).toBeTruthy();
    },
  );

  it('keeps a complete fractional measurement when the inner layout arrives later', () => {
    renderParent();
    act(() => {
      mockNativeEvents.header?.props.onLayout(headerLayoutEvent(182.2));
      onFullLayout?.(headerLayoutEvent(182.2));
    });
    expect(mockNativeEvents.headerHeight).toBe(183);
    act(() => callbacks.onHeaderLayout?.('A', 182.2));
    expect(mockNativeEvents.headerHeight).toBe(183);
  });

  it('measures same-height variants and rejects obsolete variant/layout snapshots', () => {
    renderParent();
    act(() => onFullLayout?.(headerLayoutEvent(182.2)));
    for (const variant of ['A', 'B', 'A'])
      act(() => callbacks.onHeaderVariantChange?.(variant));
    expect(measurements).toHaveLength(3);
    act(() => measurements[2](0, 0, 400, 182.2));
    expect(mockNativeEvents.headerHeight).toBe(183);
    act(() => {
      measurements[0](0, 0, 400, 292.2);
      measurements[1](0, 0, 400, 240.2);
    });
    expect(mockNativeEvents.headerHeight).toBe(183);
    act(() => callbacks.onHeaderVariantChange?.('B'));
    act(() => onFullLayout?.(headerLayoutEvent(192.8)));
    act(() => measurements[3](0, 0, 400, 182.2));
    expect(mockNativeEvents.headerHeight).toBe(193);
  });
});

describe('native header Spotlight ownership', () => {
  let currentState: ISpotlightScrollState | null | undefined;
  const pageKeys = [
    'native-spot',
    'native-perps',
    'native-nft',
    'native-history',
  ];
  const HeaderProbe = () => {
    currentState = React.useContext(SpotlightScrollStateContext);
    return null;
  };
  const mountPager = () => {
    const ref = createRef<ITabContainerRef>();
    render(
      <HomeNativePager
        ref={ref}
        tabs={[
          { id: EHomeWalletTab.Portfolio, name: 'Spot', component: null },
          { id: EHomeWalletTab.Perps, name: 'Perps', component: null },
          { id: EHomeWalletTab.NFT, name: 'NFT', component: null },
          { id: EHomeWalletTab.History, name: 'History', component: null },
        ]}
        renderHeader={() => <HeaderProbe />}
        renderTabBar={() => null}
        onTabChange={jest.fn()}
      />,
    );
    return ref;
  };
  const emitSettled = (position: number, pageKey = pageKeys[position]) => {
    act(() =>
      mockNativeEvents.onCollapsibleStateChanged?.({
        nativeEvent: {
          position,
          pageKey,
          headerOffset: 0,
          headerSettledAtTop: true,
        },
      }),
    );
  };

  beforeEach(() => {
    mockRenderParentHeader = true;
    currentState = undefined;
  });
  afterEach(() => {
    mockRenderParentHeader = false;
    mockMountedPageLifecycle = false;
    mockReadyWithMapping = false;
  });

  it('keeps unknown or mismatched page identities paused', () => {
    mountPager();
    emitSettled(0);
    expect(currentState).toBeNull();
    act(() => mockNativeEvents.onMountedPagesChanged?.({ pageKeys }));
    emitSettled(0, String(EHomeWalletTab.Portfolio));
    expect(currentState).toBeNull();
    emitSettled(1);
    expect(currentState).toBeNull();
    emitSettled(0);
    expect(currentState).toMatchObject({
      pageKey: pageKeys[0],
      headerSettledAtTop: true,
    });
  });

  it('accepts a fresh same-page snapshot after repeated commands without idle', () => {
    const ref = mountPager();
    act(() => mockNativeEvents.onMountedPagesChanged?.({ pageKeys }));
    emitSettled(0);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      act(() => ref.current?.setIndex(0));
      expect(currentState).toBeNull();
      emitSettled(0);
      expect(currentState?.headerSettledAtTop).toBe(true);
    }
    act(() => ref.current?.syncCurrentPage?.());
    expect(currentState).toBeNull();
    emitSettled(0);
    expect(currentState?.headerSettledAtTop).toBe(true);
  });

  it('accepts a selected-page ready snapshot in the same JS batch', () => {
    mountPager();
    act(() => mockNativeEvents.onMountedPagesChanged?.({ pageKeys }));
    act(() => {
      mockNativeEvents.onPageSelected?.({ nativeEvent: { position: 3 } });
      mockNativeEvents.onCollapsibleStateChanged?.({
        nativeEvent: {
          position: 3,
          pageKey: pageKeys[3],
          headerOffset: 0,
          headerSettledAtTop: true,
        },
      });
    });
    expect(currentState).toMatchObject({
      pageKey: pageKeys[3],
      headerSettledAtTop: true,
    });
  });

  it('accepts the selected far-jump snapshot without a horizontal idle event', () => {
    const ref = mountPager();
    act(() => mockNativeEvents.onMountedPagesChanged?.({ pageKeys }));
    emitSettled(0);
    act(() => ref.current?.setIndex(3));
    expect(currentState).toBeNull();
    act(() =>
      mockNativeEvents.onPageSelected?.({ nativeEvent: { position: 3 } }),
    );
    emitSettled(0);
    expect(currentState).toBeNull();
    emitSettled(3);
    expect(currentState).toMatchObject({
      pageKey: pageKeys[3],
      headerSettledAtTop: true,
    });
  });

  it('preserves a child-committed mapping while tabs are added and removed', () => {
    mockMountedPageLifecycle = true;
    const spot = {
      id: EHomeWalletTab.Portfolio,
      name: 'Spot',
      component: null,
    };
    const nft = { id: EHomeWalletTab.NFT, name: 'NFT', component: null };
    const props = {
      renderHeader: () => <HeaderProbe />,
      renderTabBar: () => null,
      onTabChange: jest.fn(),
    };
    const screen = render(<HomeNativePager {...props} tabs={[spot]} />);
    const actualKey = String(
      (
        React.Children.toArray([
          <React.Fragment key={spot.id} />,
        ])[0] as React.ReactElement
      ).key,
    );
    emitSettled(0, actualKey);
    expect(currentState?.headerSettledAtTop).toBe(true);
    for (const tabs of [[spot, nft], [spot]]) {
      screen.rerender(<HomeNativePager {...props} tabs={tabs} />);
      emitSettled(0, actualKey);
      expect(currentState?.headerSettledAtTop).toBe(true);
    }
  });

  it('keeps a deduplicated page mapping across label-only changes', () => {
    mockMountedPageLifecycle = true;
    const spot = {
      id: EHomeWalletTab.Portfolio,
      name: 'Spot',
      component: null,
    };
    const props = {
      renderHeader: () => <HeaderProbe />,
      renderTabBar: () => null,
      onTabChange: jest.fn(),
    };
    const screen = render(<HomeNativePager {...props} tabs={[spot]} />);
    const actualKey = String(
      (
        React.Children.toArray([
          <React.Fragment key={spot.id} />,
        ])[0] as React.ReactElement
      ).key,
    );
    emitSettled(0, actualKey);
    const immediateCalls = mockSetPageWithoutAnimation.mock.calls.length;
    const animatedCalls = mockSetPage.mock.calls.length;
    screen.rerender(
      <HomeNativePager {...props} tabs={[{ ...spot, name: 'Portfolio' }]} />,
    );
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(immediateCalls);
    expect(mockSetPage).toHaveBeenCalledTimes(animatedCalls);
    expect(currentState?.headerSettledAtTop).toBe(true);
  });

  it('preserves child mapping and readiness committed before the parent effect', () => {
    mockMountedPageLifecycle = true;
    mockReadyWithMapping = true;
    const spot = {
      id: EHomeWalletTab.Portfolio,
      name: 'Spot',
      component: null,
    };
    const nft = { id: EHomeWalletTab.NFT, name: 'NFT', component: null };
    const props = {
      renderHeader: () => <HeaderProbe />,
      renderTabBar: () => null,
      onTabChange: jest.fn(),
    };
    const screen = render(<HomeNativePager {...props} tabs={[spot]} />);
    expect(currentState?.headerSettledAtTop).toBe(true);
    screen.rerender(<HomeNativePager {...props} tabs={[spot, nft]} />);
    expect(currentState?.headerSettledAtTop).toBe(true);
  });
});
