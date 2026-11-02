/**
 * @jest-environment jsdom
 */
/* eslint-disable react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  TabBar as IndependentTabBar,
  TabBarItem as IndependentTabBarItem,
} from '../TabBar';

import { TabBar, TabBarItem } from './TabBar';

import type { SharedValue } from 'react-native-reanimated';

type ISharedValue<T> = { value: T };
type IAnimatedReaction = {
  prepare: () => unknown;
  react: (value: unknown, previous: unknown) => void;
  previous: unknown;
};

const mockScrollTo = jest.fn();
const mockScrollToIndex = jest.fn();
const mockAnimatedReactions: IAnimatedReaction[] = [];
let mockScrollOnContentSizeChange: ((width: number) => void) | undefined;
let mockScrollOnLayout: ((event: unknown) => void) | undefined;
let mockViewportWidth = 200;
let mockContentWidth = 432;
let mockRTL = false;
let mockItemLayouts = new Map<string, { x: number; width: number }>();
const mockTabNames = ['Watchlist', 'Trending', 'Stocks', 'Perps'];
const mockTabNamesBeforeInsert = ['Watchlist', 'Stocks', 'Perps'];
const mockInitialFocusedTab = { value: 'Perps' } as SharedValue<string>;
const mockInteractiveFocusedTab = {
  value: 'Watchlist',
} as SharedValue<string>;
const mockSecondaryFocusedTab = {
  value: 'Watchlist',
} as SharedValue<string>;
const mockIndexDecimal = { value: 0 } as SharedValue<number>;
const mockInitialTabPress = jest.fn();
const mockInteractiveTabPress = jest.fn((name: string) => {
  mockInteractiveFocusedTab.value = name;
});
const mockSecondaryTabPress = jest.fn();

function runAnimatedReactions() {
  mockAnimatedReactions.forEach((reaction) => {
    const value = reaction.prepare();
    reaction.react(value, reaction.previous);
    reaction.previous = value;
  });
}

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    __esModule: true,
    default: {
      Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
      View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    },
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: jest.fn(() => 0),
    interpolateColor: jest.fn(() => '#000'),
    runOnJS: (callback: (...args: unknown[]) => void) => callback,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: unknown, previous: unknown) => void,
    ) => {
      const reactionRef = React.useRef<IAnimatedReaction>({
        prepare,
        react,
        previous: undefined,
      });
      reactionRef.current.prepare = prepare;
      reactionRef.current.react = react;

      React.useEffect(() => {
        const reaction = reactionRef.current;
        mockAnimatedReactions.push(reaction);
        const value = reaction.prepare();
        reaction.react(value, reaction.previous);
        reaction.previous = value;
        return () => {
          const index = mockAnimatedReactions.indexOf(reaction);
          if (index >= 0) {
            mockAnimatedReactions.splice(index, 1);
          }
        };
      }, []);
    },
    useAnimatedStyle: jest.fn(() => ({})),
    useDerivedValue: (factory: () => unknown) => ({
      get value() {
        return factory();
      },
    }),
    useSharedValue: <T,>(value: T): ISharedValue<T> =>
      React.useRef({ value }).current,
    withTiming: (value: unknown) => value,
  };
});

jest.mock('use-debounce', () => ({
  useThrottledCallback: (callback: (...args: unknown[]) => void) => callback,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('react-native', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const View = React.forwardRef<
    HTMLDivElement,
    {
      children?: ReactNode;
      onLayout?: (event: unknown) => void;
      testID?: string;
    }
  >(({ children, onLayout, testID }, ref) => {
    const nodeRef = React.useRef<HTMLDivElement>(null);
    const previousWidthRef = React.useRef<number | undefined>(undefined);
    React.useImperativeHandle(ref, () => nodeRef.current as HTMLDivElement);
    React.useLayoutEffect(() => {
      if (testID?.startsWith('tab-bar-scroll-item-')) {
        const name = testID.slice('tab-bar-scroll-item-'.length);
        const layout = mockItemLayouts.get(name);
        if (layout && nodeRef.current) {
          nodeRef.current.getBoundingClientRect = () =>
            ({
              left: mockItemLayouts.get(name)?.x ?? 0,
              width: mockItemLayouts.get(name)?.width ?? 0,
            }) as DOMRect;
          if (previousWidthRef.current !== layout.width) {
            previousWidthRef.current = layout.width;
            onLayout?.({ nativeEvent: { layout } });
          }
        }
      }
    }, [onLayout, testID]);
    return (
      <div ref={nodeRef} data-testid={testID}>
        {children}
      </div>
    );
  });
  View.displayName = 'MockView';
  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View,
  };
});

jest.mock('../../content', () => ({
  Divider: () => <hr />,
}));

jest.mock('../../layouts', () => {
  const React = jest.requireActual('react') as typeof import('react');

  const ScrollView = React.forwardRef(
    (
      {
        children,
        onContentSizeChange,
        onLayout,
      }: {
        children?: ReactNode;
        onContentSizeChange?: (width: number, height: number) => void;
        onLayout?: (event: unknown) => void;
      },
      ref,
    ) => {
      const nodeRef = React.useRef<HTMLDivElement>(null);
      const previousSizeRef = React.useRef<
        | {
            viewport: number;
            content: number;
          }
        | undefined
      >(undefined);
      React.useImperativeHandle(ref, () => ({
        scrollTo: mockScrollTo,
        getScrollableNode: () => nodeRef.current,
        getInnerViewNode: () => nodeRef.current,
      }));
      mockScrollOnContentSizeChange = (width) =>
        onContentSizeChange?.(width, 44);
      mockScrollOnLayout = onLayout;
      React.useLayoutEffect(() => {
        if (nodeRef.current) {
          Object.defineProperty(nodeRef.current, 'clientWidth', {
            configurable: true,
            get: () => mockViewportWidth,
          });
          Object.defineProperty(nodeRef.current, 'scrollWidth', {
            configurable: true,
            get: () => mockContentWidth,
          });
        }
        if (previousSizeRef.current?.viewport !== mockViewportWidth) {
          onLayout?.({ nativeEvent: { layout: { width: mockViewportWidth } } });
        }
        if (previousSizeRef.current?.content !== mockContentWidth) {
          onContentSizeChange?.(mockContentWidth, 44);
        }
        previousSizeRef.current = {
          viewport: mockViewportWidth,
          content: mockContentWidth,
        };
      }, [onContentSizeChange, onLayout]);
      return (
        <div
          ref={nodeRef}
          data-testid="tab-bar-scroll-view"
          style={{ direction: mockRTL ? 'rtl' : 'ltr' }}
        >
          {children}
        </div>
      );
    },
  );
  ScrollView.displayName = 'MockScrollView';

  const ListView = React.forwardRef(
    (
      {
        data,
        onContentSizeChange,
        onLayout,
        renderItem,
      }: {
        data: string[];
        onContentSizeChange?: () => void;
        onLayout?: () => void;
        renderItem: (params: { item: string; index: number }) => ReactNode;
      },
      ref,
    ) => {
      React.useImperativeHandle(ref, () => ({
        scrollToIndex: mockScrollToIndex,
      }));
      React.useLayoutEffect(() => {
        onLayout?.();
        onContentSizeChange?.();
      }, [onContentSizeChange, onLayout]);
      return (
        <div data-testid="tab-bar-native-list">
          {data.map((item, index) => (
            <div key={item}>{renderItem({ item, index })}</div>
          ))}
        </div>
      );
    },
  );
  ListView.displayName = 'MockListView';

  return {
    ListView,
    ScrollView,
  };
});

jest.mock('../../primitives', () => {
  const Stack = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => {
    if (onPress) {
      return (
        <button data-testid={testID} type="button" onClick={onPress}>
          {children}
        </button>
      );
    }
    return <div data-testid={testID}>{children}</div>;
  };

  return {
    GradientMask: Stack,
    SizableText: ({
      children,
      color,
    }: {
      children?: ReactNode;
      color?: string;
    }) => <span data-color={color}>{children}</span>,
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('../../shared/tamagui', () => ({
  getConfig: () => ({ fontsParsed: {} }),
  useTheme: () => ({
    text: { val: '#000' },
    textInverse: { val: '#fff' },
    textSubdued: { val: '#777' },
  }),
}));

jest.mock('../../utils/getFontSize', () => ({
  getFontToken: jest.fn(),
}));

jest.mock('../../utils/scale', () => ({
  fs: (value: number) => value,
}));

jest.mock('../../utils/webFontFamily', () => ({
  webFontFamily: 'sans-serif',
}));

describe('TabBar scrollable focus handling', () => {
  it('re-exports the single independent UI implementation', () => {
    expect(TabBar).toBe(IndependentTabBar);
    expect(TabBarItem).toBe(IndependentTabBarItem);
  });
  beforeEach(() => {
    jest.useFakeTimers();
    platformEnv.isNative = false;
    mockScrollTo.mockReset();
    mockScrollToIndex.mockReset();
    mockAnimatedReactions.splice(0, mockAnimatedReactions.length);
    mockScrollOnContentSizeChange = undefined;
    mockScrollOnLayout = undefined;
    mockViewportWidth = 200;
    mockContentWidth = 432;
    mockRTL = false;
    mockItemLayouts = new Map(
      mockTabNames.map((name, index) => [name, { x: index * 100, width: 100 }]),
    );
    mockInitialFocusedTab.value = 'Perps';
    mockInteractiveFocusedTab.value = 'Watchlist';
    mockSecondaryFocusedTab.value = 'Watchlist';
    mockIndexDecimal.value = 0;
    mockInitialTabPress.mockReset();
    mockInteractiveTabPress.mockClear();
    mockSecondaryTabPress.mockReset();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('scrolls the initially focused tab into view after the list is ready', () => {
    render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 200, animated: true });

    act(() => {
      mockScrollOnLayout?.({
        nativeEvent: { layout: { width: mockViewportWidth } },
      });
      mockScrollOnContentSizeChange?.(mockContentWidth);
      jest.advanceTimersByTime(100);
    });

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });

  it('waits until the initially focused tab is available before aligning', () => {
    const { rerender } = render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames.slice(0, 2)}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockScrollTo).not.toHaveBeenCalled();

    rerender(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 200, animated: true });
  });

  it('realigns the focused tab when the tab structure changes', () => {
    mockContentWidth = 332;
    mockItemLayouts.set('Stocks', { x: 100, width: 100 });
    mockItemLayouts.set('Perps', { x: 200, width: 100 });
    const { rerender } = render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNamesBeforeInsert}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 100, animated: true });

    mockContentWidth = 432;
    mockItemLayouts.set('Stocks', { x: 200, width: 100 });
    mockItemLayouts.set('Perps', { x: 300, width: 100 });

    rerender(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 200, animated: true });
  });

  it('remeasures equal-width tabs after reorder without size callbacks', () => {
    mockInitialFocusedTab.value = 'Stocks';
    const { rerender } = render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 150, animated: true });
    mockScrollTo.mockClear();

    mockItemLayouts.set('Trending', { x: 200, width: 100 });
    mockItemLayouts.set('Stocks', { x: 100, width: 100 });
    rerender(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={['Watchlist', 'Stocks', 'Trending', 'Perps']}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 50, animated: true });
  });

  it('reads the selected tab position after an earlier tab grows', () => {
    render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 200, animated: true });

    mockItemLayouts.set('Watchlist', { x: 0, width: 150 });
    mockItemLayouts.set('Trending', { x: 150, width: 100 });
    mockItemLayouts.set('Stocks', { x: 250, width: 100 });
    mockItemLayouts.set('Perps', { x: 350, width: 100 });
    mockContentWidth = 482;
    act(() => {
      mockScrollOnContentSizeChange?.(482);
      jest.advanceTimersByTime(100);
    });
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 250, animated: true });
  });

  it('retains the old non-keep leading alignment for the first three tabs', () => {
    render(
      <TabBar
        focusedTab={mockInteractiveFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInteractiveTabPress}
        scrollable
      />,
    );
    fireEvent.click(screen.getByText('Stocks').parentElement as HTMLElement);
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });
    fireEvent.click(screen.getByText('Perps').parentElement as HTMLElement);
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 232, animated: true });
  });

  it('uses the web scrollLeft convention for RTL tab geometry', () => {
    mockRTL = true;
    mockItemLayouts = new Map(
      mockTabNames.map((name, index) => [
        name,
        { x: (3 - index) * 100, width: 100 },
      ]),
    );
    render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: -232, animated: true });
  });

  it('keeps the pressed tab focused while the pager reports intermediate tabs', () => {
    render(
      <TabBar
        focusedTab={mockInteractiveFocusedTab}
        indexDecimal={mockIndexDecimal}
        tabNames={mockTabNames}
        onTabPress={mockInteractiveTabPress}
        scrollable
        keepFocusedTabVisible
        directTabPressAnimation
        directTabPressAnimationMode="instant"
      />,
    );

    fireEvent.click(screen.getByText('Perps').parentElement as HTMLElement);

    expect(mockInteractiveTabPress).toHaveBeenCalledWith('Perps');
    expect(screen.getByText('Perps').getAttribute('data-color')).toBe('$text');

    act(() => {
      mockInteractiveFocusedTab.value = 'Trending';
      mockIndexDecimal.value = 1;
      runAnimatedReactions();
    });

    expect(screen.getByText('Perps').getAttribute('data-color')).toBe('$text');
    expect(screen.getByText('Trending').getAttribute('data-color')).toBe(
      '$textSubdued',
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 200, animated: true });
  });

  it('accepts rapid presses on different tabs', () => {
    render(
      <TabBar
        focusedTab={mockInteractiveFocusedTab}
        indexDecimal={mockIndexDecimal}
        tabNames={mockTabNames}
        onTabPress={mockInteractiveTabPress}
        scrollable
        keepFocusedTabVisible
        directTabPressAnimation
        directTabPressAnimationMode="instant"
      />,
    );

    fireEvent.click(screen.getByText('Perps').parentElement as HTMLElement);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    fireEvent.click(screen.getByText('Stocks').parentElement as HTMLElement);

    expect(mockInteractiveTabPress).toHaveBeenNthCalledWith(1, 'Perps');
    expect(mockInteractiveTabPress).toHaveBeenNthCalledWith(2, 'Stocks');
    expect(screen.getByText('Perps').getAttribute('data-color')).toBe(
      '$textSubdued',
    );
    expect(screen.getByText('Stocks').getAttribute('data-color')).toBe('$text');
  });

  it('keeps tab press suppression isolated between tab bars', () => {
    render(
      <>
        <TabBar
          focusedTab={mockInteractiveFocusedTab}
          tabNames={mockTabNames}
          onTabPress={mockInteractiveTabPress}
          scrollable
        />
        <TabBar
          focusedTab={mockSecondaryFocusedTab}
          tabNames={mockTabNames}
          onTabPress={mockSecondaryTabPress}
          scrollable
        />
      </>,
    );

    fireEvent.click(
      screen.getAllByText('Perps')[0].parentElement as HTMLElement,
    );
    act(() => {
      mockSecondaryFocusedTab.value = 'Stocks';
      runAnimatedReactions();
    });

    expect(screen.getAllByText('Stocks')[1].getAttribute('data-color')).toBe(
      '$text',
    );
  });

  it('aligns first, middle, and last tabs from measured widths', () => {
    render(
      <TabBar
        focusedTab={mockInteractiveFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInteractiveTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    fireEvent.click(screen.getByText('Trending').parentElement as HTMLElement);
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 50, animated: true });

    fireEvent.click(screen.getByText('Perps').parentElement as HTMLElement);
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 200, animated: true });

    fireEvent.click(screen.getByText('Watchlist').parentElement as HTMLElement);
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });
  });

  it('clamps narrow content and realigns when a long label or viewport changes', () => {
    mockViewportWidth = 500;
    const { rerender } = render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });

    mockInitialFocusedTab.value = 'Trending';
    mockViewportWidth = 200;
    mockContentWidth = 492;
    mockItemLayouts.set('Trending', { x: 100, width: 160 });
    rerender(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => runAnimatedReactions());
    act(() => {
      mockScrollOnLayout?.({ nativeEvent: { layout: { width: 200 } } });
      mockScrollOnContentSizeChange?.(492);
      jest.advanceTimersByTime(100);
    });
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 80, animated: true });
  });

  it('keeps custom items and toolbar while deleting the selected last tab', () => {
    const renderItem = jest.fn(
      (props: { name: string; onPress: (name: string) => void }) => (
        <button type="button" onClick={() => props.onPress(props.name)}>
          Custom {props.name}
        </button>
      ),
    );
    const { rerender } = render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        renderItem={renderItem}
        renderToolbar={() => <span>Toolbar</span>}
        scrollable
        keepFocusedTabVisible
      />,
    );
    expect(screen.getByText('Toolbar')).toBeTruthy();
    expect(screen.getByText('Custom Perps')).toBeTruthy();
    const retainedCustomItem = screen.getByText('Custom Stocks');
    act(() => jest.advanceTimersByTime(100));
    mockScrollTo.mockClear();

    mockInitialFocusedTab.value = 'Stocks';
    rerender(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames.slice(0, 3)}
        onTabPress={mockInitialTabPress}
        renderItem={renderItem}
        renderToolbar={() => <span>Toolbar</span>}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => {
      runAnimatedReactions();
      mockScrollOnContentSizeChange?.(332);
      jest.advanceTimersByTime(100);
    });
    expect(screen.queryByText('Custom Perps')).toBeNull();
    expect(screen.getByText('Custom Stocks')).toBe(retainedCustomItem);
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 100, animated: true });
  });

  it('keeps the native scrollable ListView behavior unchanged', () => {
    platformEnv.isNative = true;
    render(
      <TabBar
        focusedTab={mockInitialFocusedTab}
        tabNames={mockTabNames}
        onTabPress={mockInitialTabPress}
        scrollable
        keepFocusedTabVisible
      />,
    );
    act(() => jest.advanceTimersByTime(100));
    expect(screen.getByTestId('tab-bar-native-list')).toBeTruthy();
    expect(mockScrollToIndex).toHaveBeenCalledWith({
      index: 3,
      viewPosition: 1,
    });
    expect(mockScrollTo).not.toHaveBeenCalled();
  });
});
