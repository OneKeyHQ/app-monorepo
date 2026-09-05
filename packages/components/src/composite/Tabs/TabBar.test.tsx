/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { TabBar } from './TabBar';

import type { SharedValue } from 'react-native-reanimated';

type ISharedValue<T> = { value: T };
type IAnimatedReaction = {
  prepare: () => unknown;
  react: (value: unknown, previous: unknown) => void;
  previous: unknown;
};

const mockScrollToIndex = jest.fn();
const mockAnimatedReactions: IAnimatedReaction[] = [];
let mockListOnContentSizeChange: (() => void) | undefined;
let mockListOnLayout: (() => void) | undefined;
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
  default: { isNative: true },
}));

jest.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../content', () => ({
  Divider: () => <hr />,
}));

jest.mock('../../layouts', () => {
  const React = jest.requireActual('react') as typeof import('react');

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
      mockListOnContentSizeChange = onContentSizeChange;
      mockListOnLayout = onLayout;
      React.useLayoutEffect(() => {
        onLayout?.();
        onContentSizeChange?.();
      }, [onContentSizeChange, onLayout]);
      return (
        <div>
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
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
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
  beforeEach(() => {
    jest.useFakeTimers();
    mockScrollToIndex.mockReset();
    mockAnimatedReactions.splice(0, mockAnimatedReactions.length);
    mockListOnContentSizeChange = undefined;
    mockListOnLayout = undefined;
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

    expect(mockScrollToIndex).toHaveBeenLastCalledWith({
      index: 3,
      viewPosition: 1,
    });

    act(() => {
      mockListOnLayout?.();
      mockListOnContentSizeChange?.();
      jest.advanceTimersByTime(100);
    });

    expect(mockScrollToIndex).toHaveBeenCalledTimes(1);
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
    expect(mockScrollToIndex).not.toHaveBeenCalled();

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
    expect(mockScrollToIndex).toHaveBeenCalledTimes(1);
    expect(mockScrollToIndex).toHaveBeenLastCalledWith({
      index: 3,
      viewPosition: 1,
    });
  });

  it('realigns the focused tab when the tab structure changes', () => {
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
    expect(mockScrollToIndex).toHaveBeenLastCalledWith({
      index: 2,
      viewPosition: 1,
    });

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
    expect(mockScrollToIndex).toHaveBeenCalledTimes(2);
    expect(mockScrollToIndex).toHaveBeenLastCalledWith({
      index: 3,
      viewPosition: 1,
    });
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
    expect(mockScrollToIndex).toHaveBeenLastCalledWith({
      index: 3,
      viewPosition: 1,
    });
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
});
