/** @jest-environment jsdom */

import type { Context, ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { MarketDetailPager } from '../../views/Market/MarketDetailV2/components/InformationTabs/layout/MarketDetailPager.ios';

import { LightweightChart } from './LightweightChart.native';

const mockRequestLayout = jest.fn();
const mockReload = jest.fn();
const mockInjectJavaScript = jest.fn();
const mockMount = jest.fn();
let mockIsIOS = true;
let mockNativeCommands: { requestLayout?: number } | undefined = {
  requestLayout: 0,
};
let mockSendReady: () => void;
let mockPagerStateChanged: (event: {
  nativeEvent: {
    headerSettledAtTop: boolean;
    headerOffset: number;
    position: number;
    pageKey: string;
  };
}) => void;
const mockReactions = new Set<{
  prepare: () => unknown;
  react: (value: unknown, previous: unknown) => void;
  previous: unknown;
}>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOS() {
      return mockIsIOS;
    },
  },
}));

jest.mock('react-native', () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AppState: { addEventListener: () => ({ remove: jest.fn() }) },
  UIManager: {
    getViewManagerConfig: () =>
      mockNativeCommands ? { Commands: mockNativeCommands } : null,
  },
}));

jest.mock('@onekeyhq/components', () => ({
  useTheme: () => ({ bgApp: { val: '#000' } }),
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CollapsibleTabContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(null),
}));

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    runOnJS: (callback: (...args: unknown[]) => void) => callback,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown, previous: unknown) => void,
    ) => {
      const reaction = React.useRef({
        prepare,
        react,
        previous: null as unknown,
      });
      reaction.current.prepare = prepare;
      reaction.current.react = react;
      React.useEffect(() => {
        const current = reaction.current;
        mockReactions.add(current);
        return () => {
          mockReactions.delete(current);
        };
      }, []);
    },
  };
});

jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    CollapsiblePagerView: React.forwardRef(
      (
        {
          header,
          onCollapsibleStateChanged,
        }: {
          header: ReactNode;
          onCollapsibleStateChanged: typeof mockPagerStateChanged;
        },
        _ref,
      ) => {
        mockPagerStateChanged = onCollapsibleStateChanged;
        return <div>{header}</div>;
      },
    ),
  };
});

jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return React.forwardRef(
    (
      {
        onMessage,
      }: {
        onMessage: (event: { nativeEvent: { data: string } }) => void;
      },
      ref,
    ) => {
      mockSendReady = () =>
        onMessage({ nativeEvent: { data: '{"type":"ready"}' } });
      React.useImperativeHandle(
        ref,
        () => ({
          requestLayout: mockRequestLayout,
          reload: mockReload,
          injectJavaScript: mockInjectJavaScript,
        }),
        [],
      );
      React.useEffect(() => {
        mockMount();
      }, []);
      return <div data-testid="native-webview" />;
    },
  );
});

jest.mock('./hooks/useChartConfig', () => ({
  useChartConfig: () => ({ data: [] }),
}));
jest.mock('./utils/htmlTemplate', () => ({
  generateChartHTML: () => '<head></head>',
}));
jest.mock('./utils/formatChartPriceSource', () => ({
  __esModule: true,
  default: 'function () {}',
}));

type ITabs = {
  headerHeight: number;
  scrollYCurrent: { value: number };
  headerTranslateY: { value: number };
};
const { CollapsibleTabContext } = jest.requireMock<{
  CollapsibleTabContext: Context<ITabs | null>;
}>('@onekeyhq/components/src/composite/Tabs/CollapsibleTabContext');

function moveHeader(tabs: ITabs, offset: number) {
  act(() => {
    tabs.scrollYCurrent.value = offset;
    tabs.headerTranslateY.value = -Math.min(offset, tabs.headerHeight);
    for (const reaction of mockReactions) {
      const next = reaction.prepare();
      reaction.react(next, reaction.previous);
      reaction.previous = next;
    }
  });
}

const mockTabs: ITabs = {
  headerHeight: 519,
  scrollYCurrent: { value: 2000 },
  headerTranslateY: { value: -519 },
};

function renderChart(offset = 2000) {
  mockTabs.scrollYCurrent.value = offset;
  mockTabs.headerTranslateY.value = -Math.min(offset, mockTabs.headerHeight);
  const view = render(
    <CollapsibleTabContext.Provider value={mockTabs}>
      <LightweightChart data={[]} height={345} />
    </CollapsibleTabContext.Provider>,
  );
  moveHeader(mockTabs, offset);
  return { ...view, tabs: mockTabs };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockIsIOS = true;
  mockNativeCommands = { requestLayout: 0 };
  mockTabs.scrollYCurrent.value = 2000;
  mockTabs.headerTranslateY.value = -519;
});

afterEach(() => {
  jest.useRealTimers();
});

it('updates native layout after an offscreen-created chart returns, preserving its WebView', () => {
  const { tabs } = renderChart();
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
  moveHeader(tabs, 300);
  act(() => {
    jest.advanceTimersByTime(80);
  });
  moveHeader(tabs, 0);
  act(() => {
    jest.advanceTimersByTime(99);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(mockRequestLayout).toHaveBeenCalledTimes(1);
  expect(mockMount).toHaveBeenCalledTimes(1);
  expect(mockReload).not.toHaveBeenCalled();
});

it('synchronizes again when a partially returned header continues moving', () => {
  const { tabs } = renderChart();
  moveHeader(tabs, 300);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(mockRequestLayout).toHaveBeenCalledTimes(1);
  moveHeader(tabs, 0);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(mockRequestLayout).toHaveBeenCalledTimes(2);
});

it('cancels a pending layout when the chart leaves the viewport again', () => {
  const { tabs } = renderChart();
  moveHeader(tabs, 300);
  moveHeader(tabs, 2000);
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
});

it('cancels a pending layout on unmount', () => {
  const { tabs, unmount } = renderChart();
  moveHeader(tabs, 0);
  unmount();
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
});

it('does not request iOS layout synchronization on Android', () => {
  mockIsIOS = false;
  const { tabs } = renderChart();
  moveHeader(tabs, 0);
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
});

it.each([{}, undefined])(
  'remounts an offscreen-created chart once when the native command is absent (%j)',
  (nativeCommands) => {
    mockNativeCommands = nativeCommands;
    const { tabs } = renderChart();
    act(() => {
      mockSendReady();
    });
    moveHeader(tabs, 0);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockRequestLayout).not.toHaveBeenCalled();
    expect(mockMount).toHaveBeenCalledTimes(2);
    act(() => {
      mockSendReady();
    });
    moveHeader(tabs, 2000);
    moveHeader(tabs, 0);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockMount).toHaveBeenCalledTimes(2);
    expect(mockRequestLayout).not.toHaveBeenCalled();
  },
);

it('preserves a chart loaded visibly on an older native shell', () => {
  mockNativeCommands = {};
  const { tabs } = renderChart(0);
  act(() => {
    mockSendReady();
  });
  moveHeader(tabs, 2000);
  moveHeader(tabs, 0);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
  expect(mockMount).toHaveBeenCalledTimes(1);
});

it('recovers an older shell when the chart leaves during initial loading', () => {
  mockNativeCommands = {};
  const { tabs } = renderChart(0);
  moveHeader(tabs, 2000);
  act(() => {
    mockSendReady();
  });
  moveHeader(tabs, 0);
  act(() => {
    jest.advanceTimersByTime(100);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
  expect(mockMount).toHaveBeenCalledTimes(2);
});

function NativePagerPage(_props: { name: string }) {
  return null;
}

function renderNativePagerChart() {
  return render(
    <MarketDetailPager
      initialTabName="Overview"
      renderHeader={() => <LightweightChart data={[]} height={345} />}
      renderTabBar={() => <div />}
      onTabChange={() => undefined}
    >
      {[<NativePagerPage key="overview" name="Overview" />]}
    </MarketDetailPager>,
  );
}

function settleNativeHeader(settled: boolean, offset: number) {
  act(() => {
    mockPagerStateChanged?.({
      nativeEvent: {
        headerSettledAtTop: settled,
        headerOffset: offset,
        position: 0,
        pageKey: 'overview',
      },
    });
    jest.advanceTimersByTime(100);
  });
  act(() => {
    jest.advanceTimersByTime(100);
  });
}

it('synchronizes layout through the real iOS pager without a legacy tabs context', () => {
  renderNativePagerChart();
  settleNativeHeader(false, 519);
  act(() => {
    mockSendReady();
  });
  settleNativeHeader(true, 0);
  expect(mockRequestLayout).toHaveBeenCalledTimes(1);
  expect(mockMount).toHaveBeenCalledTimes(1);
});

it('recovers loading charts in the real iOS pager on older native shells', () => {
  mockNativeCommands = {};
  renderNativePagerChart();
  settleNativeHeader(false, 519);
  act(() => {
    mockSendReady();
  });
  settleNativeHeader(true, 0);
  expect(mockRequestLayout).not.toHaveBeenCalled();
  expect(mockMount).toHaveBeenCalledTimes(2);
});

it('preserves a loaded chart and ignores initial layout settling on older shells', () => {
  mockNativeCommands = {};
  renderNativePagerChart();
  settleNativeHeader(false, 0);
  settleNativeHeader(true, 0);
  expect(mockMount).toHaveBeenCalledTimes(1);
  act(() => {
    mockSendReady();
  });
  settleNativeHeader(false, 519);
  settleNativeHeader(true, 0);
  expect(mockMount).toHaveBeenCalledTimes(1);
});

it('cancels native pager synchronization when the header moves away again', () => {
  const { unmount } = renderNativePagerChart();
  act(() => {
    mockPagerStateChanged({
      nativeEvent: {
        headerSettledAtTop: true,
        headerOffset: 0,
        position: 0,
        pageKey: 'overview',
      },
    });
  });
  act(() => {
    mockPagerStateChanged({
      nativeEvent: {
        headerSettledAtTop: false,
        headerOffset: 20,
        position: 0,
        pageKey: 'overview',
      },
    });
  });
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
  unmount();
});

it('ignores stale native header events from a different page', () => {
  renderNativePagerChart();
  act(() => {
    mockPagerStateChanged({
      nativeEvent: {
        headerSettledAtTop: true,
        headerOffset: 0,
        position: 0,
        pageKey: 'previous-page',
      },
    });
  });
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(mockRequestLayout).not.toHaveBeenCalled();
});
