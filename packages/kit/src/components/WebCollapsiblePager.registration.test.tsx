/** @jest-environment jsdom */

import * as React from 'react';

import { act, render } from '@testing-library/react';

import { useScrollContentRegistration } from '../../../components/src/composite/ScrollContentRegistration';
import { Table } from '../../../components/src/composite/Table';
import { TabsContext } from '../../../components/src/composite/Tabs/context';
import { Tab } from '../../../components/src/composite/Tabs/Tab';

import { WebCollapsiblePager, WebPagerContent } from './WebCollapsiblePager';
import { useWebPager, useWebPagerPage } from './WebCollapsiblePagerContext';

import type { IWebCollapsiblePagerRef } from './WebCollapsiblePagerContext';
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
let mockSelected: (event: { nativeEvent: { position: number } }) => void;
const mockOwnerScroll = jest.fn();
jest.mock('react-native-pager-view', () => ({
  CollapsiblePagerView: ({
    children,
    ref,
    onPageSelected,
  }: React.PropsWithChildren<{
    ref?: React.Ref<unknown>;
    onPageSelected: typeof mockSelected;
  }>) => {
    mockSelected = onPageSelected;
    React.useImperativeHandle(ref, () => ({
      setPage: () => {},
      setPageWithoutAnimation: () => {},
    }));
    return <>{children}</>;
  },
  NativeScroller: ({
    children,
    ref,
    pagerScrollKey,
  }: React.PropsWithChildren<{
    ref?: React.Ref<unknown>;
    pagerScrollKey?: string;
  }>) => {
    const node = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(
      ref,
      () => ({
        getScrollableNode: () => node.current,
        scrollTo: ({ y }: { y: number }) => {
          mockOwnerScroll(y);
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
beforeAll(() => {
  globalThis.ResizeObserver = class {
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

  it('keeps the parent content wrapper as the measured target after the nested Table effects', () => {
    let current: ReturnType<typeof useWebPagerPage> | undefined;
    function Probe() {
      current = useWebPagerPage();
      return null;
    }
    const screen = render(
      <WebCollapsiblePager
        pages={[
          {
            key: 'one',
            name: 'One',
            children: (
              <WebPagerContent>
                {table}
                <Probe />
              </WebPagerContent>
            ),
          },
        ]}
      />,
    );
    const wrapper = screen.getByTestId('pager-owner').firstElementChild;
    expect(current?.content).toBe(wrapper);
    expect(current?.contentHeight).toBeUndefined();
    expect(current?.name).toBe('One');
    expect(current?.isFocused).toBe(true);
    screen.unmount();
    expect(observerDisconnect).toHaveBeenCalled();
  });

  it('preserves explicit height for a Pager registration and ignores its stale cleanup', () => {
    let register: IRegisterScrollContent | undefined;
    let current: ReturnType<typeof useWebPagerPage> | undefined;
    function Probe() {
      current = useWebPagerPage();
      return (
        <RegistrationProbe
          onRegister={(value) => {
            register = value;
          }}
        />
      );
    }
    const screen = render(
      <WebCollapsiblePager
        pages={[{ key: 'one', name: 'One', children: <Probe /> }]}
      />,
    );
    const element = document.createElement('div');
    let first: (() => void) | undefined;
    let second: (() => void) | undefined;
    act(() => {
      first = register?.(element, 400);
    });
    act(() => {
      second = register?.(element, 600);
    });
    act(() => first?.());
    expect(current?.contentHeight).toBe(600);
    act(() => second?.());
    expect(current?.content).toBeNull();
    screen.unmount();
  });

  it('publishes content-relative metrics and active page focus without WindowScroller state', async () => {
    let current: ReturnType<typeof useWebPagerPage> | undefined;
    function Probe() {
      current = useWebPagerPage();
      return null;
    }
    const screen = render(
      <WebCollapsiblePager
        pages={[
          {
            key: 'one',
            name: 'One',
            children: (
              <WebPagerContent>
                <Probe />
              </WebPagerContent>
            ),
          },
          { key: 'two', name: 'Two', children: null },
        ]}
      />,
    );
    const owner = screen.getAllByTestId('pager-owner')[0];
    Object.defineProperty(owner, 'clientWidth', { value: 800 });
    owner.getBoundingClientRect = () => ({
      top: 100,
      bottom: 500,
      left: 0,
      right: 800,
      width: 800,
      height: 400,
      x: 0,
      y: 100,
      toJSON() {},
    });
    const content = owner.firstElementChild as HTMLElement;
    content.getBoundingClientRect = () => ({
      top: 30,
      bottom: 900,
      left: 0,
      right: 800,
      width: 800,
      height: 870,
      x: 0,
      y: 30,
      toJSON() {},
    });
    await act(async () => {
      owner.dispatchEvent(new Event('scroll'));
      await new Promise(requestAnimationFrame);
    });
    expect(current).toEqual(
      expect.objectContaining({
        width: 800,
        height: 400,
        scrollTop: 70,
        isFocused: true,
        owner,
        content,
      }),
    );
    act(() => mockSelected({ nativeEvent: { position: 1 } }));
    expect(current?.isFocused).toBe(false);
    act(() => mockSelected({ nativeEvent: { position: 0 } }));
    expect(current?.isFocused).toBe(true);
    screen.unmount();
  });

  it('restores the real owner on route return and resets page identities without remounting content', () => {
    const ref = React.createRef<IWebCollapsiblePagerRef>();
    let state: ReturnType<typeof useWebPager> | undefined;
    const mounts = jest.fn();
    function Content() {
      state = useWebPager();
      React.useEffect(mounts, []);
      return null;
    }
    const pages = [{ key: 'stable', name: 'One', children: <Content /> }];
    const screen = render(<WebCollapsiblePager ref={ref} pages={pages} />);
    const owner = screen.getByTestId('pager-owner');
    Object.defineProperty(owner, 'clientHeight', { value: 400 });
    Object.defineProperty(owner, 'scrollHeight', { value: 1200 });
    act(() => {
      owner.scrollTop = 300;
      owner.dispatchEvent(new Event('scroll'));
    });
    screen.rerender(
      <WebCollapsiblePager ref={ref} pages={pages} isRouteFocused={false} />,
    );
    owner.scrollTop = 0;
    screen.rerender(
      <WebCollapsiblePager ref={ref} pages={pages} isRouteFocused />,
    );
    expect(mockOwnerScroll).toHaveBeenLastCalledWith(300);
    expect(owner.scrollTop).toBe(300);
    act(() => state?.scrollToTop());
    expect(owner.getAttribute('data-scroll-key')).toBe('stable:1');
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(ref.current?.getFocusedTab()).toBe('One');
    screen.unmount();
  });
});
