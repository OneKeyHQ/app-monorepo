/** @jest-environment jsdom */

import * as React from 'react';

import { act, render } from '@testing-library/react';

import { useScrollContentRegistration } from '../../../components/src/composite/ScrollContentRegistration';
import { Table } from '../../../components/src/composite/Table';
import { TabsContext } from '../../../components/src/composite/Tabs/context';
import { Tab } from '../../../components/src/composite/Tabs/Tab';

import { AppPager } from './AppPager';
import { AppPagerContent } from './AppPager/AppPagerContent';
import { useAppPager } from './AppPager/context';
import { useAppPagerPage } from './AppPager/useAppPagerPage';

import type { IAppPagerRef } from './AppPager/types';
import type { IRegisterScrollContent } from '../../../components/src/composite/ScrollContentRegistration';

function mockBox({
  children,
  ref,
}: React.PropsWithChildren<{ ref?: React.Ref<HTMLDivElement> }>) {
  return <div ref={ref}>{children}</div>;
}

jest.mock('@onekeyhq/components', () => ({
  ...jest.requireActual<
    typeof import('../../../components/src/composite/ScrollContentRegistration')
  >('../../../components/src/composite/ScrollContentRegistration'),
  YStack: mockBox,
  useMedia: () => ({ gtMd: true }),
  getTokenValue: () => 0,
  useThemeName: () => 'light',
  withStaticProperties: Object.assign,
}));
jest.mock('react-native', () => ({
  View: mockBox,
  Pressable: mockBox,
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('react-native-draggable-flatlist/src/context/globalRef', () => ({
  globalRef: {},
}));
jest.mock('../../../components/src/primitives', () => ({
  YStack: mockBox,
  XStack: mockBox,
  Stack: mockBox,
  SizableText: mockBox,
}));
jest.mock('../../../components/src/primitives/Haptics', () => ({
  Haptics: {},
  ImpactFeedbackStyle: {},
}));
jest.mock('../../../components/src/actions/IconButton', () => ({
  IconButton: () => null,
}));
jest.mock('../../../components/src/layouts/ListView', () => ({
  ListView: () => null,
}));
jest.mock('../../../components/src/composite/Table/components', () => ({
  Column: () => null,
  MemoHeaderColumn: () => null,
}));
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => React.useRef({ value }).current,
}));
const mockRegisterContent = jest.fn(() => jest.fn());
const mockRestoreScrollPosition = jest.fn(() => true);
let mockRouteActive = true;
jest.mock('react-native-pager-view', () => ({
  WebCollapsiblePagerView: ({
    children,
    ref,
    header,
    stickyHeader,
    isActive,
  }: React.PropsWithChildren<{
    ref?: React.Ref<unknown>;
    header?: React.ReactNode;
    stickyHeader?: React.ReactNode;
    isActive?: boolean;
  }>) => {
    mockRouteActive = isActive ?? true;
    React.useImperativeHandle(ref, () => ({
      setPage: () => {},
      setPageWithoutAnimation: () => {},
      restoreScrollPosition: mockRestoreScrollPosition,
    }));
    return (
      <>
        {header}
        {stickyHeader}
        {children}
      </>
    );
  },
  useWebCollapsiblePagerPage: () => ({
    isFocused: true,
    isRouteActive: mockRouteActive,
    owner: null,
    content: null,
    contentHeight: undefined,
    width: 800,
    height: 400,
    scrollTop: 70,
    pendingRouteScrollTop: null,
    registerContent: mockRegisterContent,
  }),
  NativeScroller: ({
    children,
    ref,
    pagerScrollKey,
  }: React.PropsWithChildren<{
    ref?: React.Ref<unknown>;
    pagerScrollKey?: string;
  }>) => {
    const node = React.useRef<HTMLDivElement>(null);
    React.useLayoutEffect(() => {
      node.current?.setAttribute('data-collapsible-pager-active', 'true');
      node.current?.style.setProperty(
        '--ok-collapsible-pager-header-inset',
        '0px',
      );
      node.current?.style.setProperty(
        '--ok-collapsible-pager-sticky-inset',
        '0px',
      );
    }, []);
    React.useImperativeHandle(
      ref,
      () => ({
        getScrollableNode: () => node.current,
        scrollTo: ({ y }: { y: number }) => {
          if (node.current) node.current.scrollTop = y;
        },
      }),
      [],
    );
    return (
      <div
        ref={node}
        data-testid="pager-owner"
        data-scroll-key={pagerScrollKey}
      >
        {children}
      </div>
    );
  },
}));

const table = (
  <Table
    tabIntegrated
    scrollEnabled={false}
    columns={[]}
    dataSource={[{ id: '1' }]}
    keyExtractor={(item) => item.id}
  />
);

function RegistrationProbe({
  onRegister,
}: {
  onRegister: (register: IRegisterScrollContent | undefined) => void;
}) {
  onRegister(useScrollContentRegistration());
  return null;
}

const originalResizeObserver = globalThis.ResizeObserver;
const observerDisconnect = jest.fn();
const resizeCallbacks: Array<() => void> = [];
beforeAll(() => {
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallbacks.push(() => callback([], this));
    }
    observe() {}
    unobserve() {}
    disconnect = observerDisconnect;
  };
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

function LegacyContainer({
  children,
  entries,
  remeasure,
}: React.PropsWithChildren<{
  entries: React.ContextType<
    typeof TabsContext
  >['scrollTabElementsRef']['current'];
  remeasure?: () => void;
}>) {
  const inherited = React.useContext(TabsContext);
  const value = React.useMemo(
    () => ({
      ...inherited,
      scrollTabElementsRef: { current: entries },
      requestRemeasure: remeasure,
    }),
    [inherited, entries, remeasure],
  );
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

describe('Pager and legacy Table content registration', () => {
  it('keeps standalone Table and a Tab without a Container inert', () => {
    const plain = render(table);
    plain.unmount();
    const orphan = render(<Tab name="orphan">{table}</Tab>);
    orphan.unmount();
  });

  it('registers the real legacy Table element and explicit height, then cleans up', () => {
    const entries = {} as React.ContextType<
      typeof TabsContext
    >['scrollTabElementsRef']['current'];
    const remeasure = jest.fn();
    const screen = render(
      <LegacyContainer entries={entries} remeasure={remeasure}>
        <Tab name="legacy">{table}</Tab>
      </LegacyContainer>,
    );
    expect(entries.legacy.element).toBe(screen.container.firstElementChild);
    expect(entries.legacy.height).toBe(460);
    expect(remeasure).toHaveBeenCalledTimes(1);
    screen.unmount();
    expect(entries.legacy).toBeUndefined();
    expect(remeasure).toHaveBeenCalledTimes(2);
  });

  it('does not let a stale cleanup remove a new registration of the same element', () => {
    const entries = {} as React.ContextType<
      typeof TabsContext
    >['scrollTabElementsRef']['current'];
    let register: IRegisterScrollContent | undefined;
    render(
      <LegacyContainer entries={entries}>
        <Tab name="legacy">
          <RegistrationProbe
            onRegister={(value) => {
              register = value;
            }}
          />
        </Tab>
      </LegacyContainer>,
    );
    const element = document.createElement('div');
    const first = register?.(element, 400);
    const second = register?.(element, 600);
    first?.();
    expect(entries.legacy.height).toBe(600);
    second?.();
    expect(entries.legacy).toBeUndefined();
  });

  it('bridges SDK page geometry and content registration to existing page consumers', () => {
    let current: ReturnType<typeof useAppPagerPage> | undefined;
    function Probe() {
      current = useAppPagerPage();
      return null;
    }
    const screen = render(
      <AppPager
        pages={[
          {
            key: 'one',
            name: 'One',
            children: (
              <AppPagerContent>
                <Probe />
              </AppPagerContent>
            ),
          },
        ]}
      />,
    );
    expect(current).toEqual(
      expect.objectContaining({
        key: 'one',
        name: 'One',
        width: 800,
        height: 400,
        scrollTop: 70,
        isFocused: true,
      }),
    );
    expect(mockRegisterContent).toHaveBeenCalledWith(
      screen.getByTestId('pager-owner').firstElementChild,
    );
    screen.unmount();
  });

  it('forwards route activity and restore requests to the SDK while preserving business content', () => {
    const ref = React.createRef<IAppPagerRef>();
    let business: ReturnType<typeof useAppPager> | undefined;
    const mounts = jest.fn();
    function Content() {
      business = useAppPager();
      React.useEffect(mounts, []);
      return null;
    }
    const pages = [{ key: 'stable', name: 'One', children: <Content /> }];
    const screen = render(<AppPager ref={ref} pages={pages} />);
    expect(mockRouteActive).toBe(true);
    screen.rerender(
      <AppPager ref={ref} pages={pages} isRouteFocused={false} />,
    );
    expect(mockRouteActive).toBe(false);
    expect(ref.current?.restoreScrollPosition?.()).toBe(true);
    expect(mockRestoreScrollPosition).toHaveBeenCalledTimes(1);
    act(() => business?.scrollToTop());
    expect(
      screen.getByTestId('pager-owner').getAttribute('data-scroll-key'),
    ).toBe('stable:1');
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(ref.current?.getFocusedTab()).toBe('One');
    screen.unmount();
  });
});
