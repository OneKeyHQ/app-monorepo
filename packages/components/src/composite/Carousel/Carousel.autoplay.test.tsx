/** @jest-environment jsdom */

import {
  Suspense,
  forwardRef,
  startTransition,
  useImperativeHandle,
} from 'react';
import type { PropsWithChildren } from 'react';

import { Carousel } from '.';

import { act, render } from '@testing-library/react';

const TWO_ITEMS = ['first', 'second'];
const ONE_ITEM = ['only'];
const LOADING = <span>loading</span>;
const renderItem = ({ item }: { item: string }) => <span>{item}</span>;

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let mockPagerStateChange:
  | ((state: 'idle' | 'dragging' | 'settling') => void)
  | undefined;
let mockPressOut: (() => void) | undefined;
let mockPressIn: (() => void) | undefined;
let mockLayout: ((width: number, height: number) => void) | undefined;
let mockNavigationFocused = true;
const mockNavigationListeners = new Set<() => void>();

jest.mock('@react-navigation/native', () => {
  const { createContext } = jest.requireActual<typeof import('react')>('react');
  return {
    NavigationContext: createContext({
      isFocused: () => mockNavigationFocused,
      addListener: (_event: string, callback: () => void) => {
        mockNavigationListeners.add(callback);
        return () => mockNavigationListeners.delete(callback);
      },
    }),
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({ isNative: true }));

jest.mock('../../actions/IconButton', () => ({ IconButton: () => null }));
jest.mock('../../primitives', () => {
  const MockStack = ({
    children,
    onPressOut,
    onPressIn,
    onLayout,
  }: PropsWithChildren<{
    onPressOut?: () => void;
    onPressIn?: () => void;
    onLayout?: (event: {
      nativeEvent: { layout: { width: number; height: number } };
    }) => void;
  }>) => {
    if (onPressOut) mockPressOut = onPressOut;
    if (onPressIn) mockPressIn = onPressIn;
    if (onLayout)
      mockLayout = (width, height) =>
        onLayout({ nativeEvent: { layout: { width, height } } });
    return <div>{children}</div>;
  };
  return { Stack: MockStack, XStack: MockStack, YStack: MockStack };
});

jest.mock('./pager', () => ({
  PagerView: forwardRef(function MockPager(
    {
      children,
      onPageScrollStateChanged,
    }: PropsWithChildren<{
      onPageScrollStateChanged?: (event: {
        nativeEvent: { pageScrollState: string };
      }) => void;
    }>,
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      setPageWithoutAnimation: mockSetPageWithoutAnimation,
    }));
    mockPagerStateChange = (state) =>
      onPageScrollStateChanged?.({ nativeEvent: { pageScrollState: state } });
    return <div>{children}</div>;
  }),
}));

describe('Carousel autoplay eligibility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSetPage.mockClear();
    mockSetPageWithoutAnimation.mockClear();
    mockPagerStateChange = undefined;
    mockPressOut = undefined;
    mockPressIn = undefined;
    mockLayout = undefined;
    mockNavigationFocused = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderCarousel = (enabled: boolean) => (
    <Carousel
      data={TWO_ITEMS}
      renderItem={renderItem}
      pageWidth={100}
      autoPlayInterval={5000}
      autoPlayEnabled={enabled}
      loop
      infinite
    />
  );

  it('stops while disabled and resumes only after a fresh full interval', () => {
    const { rerender } = render(renderCarousel(true));
    act(() => jest.advanceTimersByTime(4000));
    rerender(renderCarousel(false));
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockSetPage).not.toHaveBeenCalled();

    rerender(renderCarousel(true));
    act(() => jest.advanceTimersByTime(4999));
    expect(mockSetPage).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });

  it('does not restart from inner idle or press-out while disabled', () => {
    render(renderCarousel(false));
    act(() => {
      mockPagerStateChange?.('dragging');
      mockPagerStateChange?.('idle');
      mockPressOut?.();
      jest.advanceTimersByTime(10_000);
    });
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('retains default autoplay and clears timers on unmount', () => {
    const { unmount } = render(
      <Carousel
        data={TWO_ITEMS}
        renderItem={renderItem}
        pageWidth={100}
        autoPlayInterval={5000}
        loop
      />,
    );
    act(() => jest.advanceTimersByTime(5000));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
    unmount();
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });

  it('does not restart on press-out after navigation loses focus', () => {
    render(renderCarousel(true));
    act(() => {
      mockNavigationFocused = false;
      mockNavigationListeners.forEach((callback) => callback());
    });
    act(() => {
      mockPressOut?.();
      jest.advanceTimersByTime(10_000);
    });
    expect(mockSetPage).not.toHaveBeenCalled();
    act(() => {
      mockNavigationFocused = true;
      mockNavigationListeners.forEach((callback) => callback());
    });
    act(() => jest.advanceTimersByTime(5000));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });

  it('ignores an already queued timer after pause and resume', () => {
    const setTimeoutSpy: jest.SpyInstance<
      ReturnType<typeof setTimeout>,
      Parameters<typeof setTimeout>
    > = jest.spyOn(globalThis, 'setTimeout');
    const { rerender } = render(renderCarousel(true));
    const staleTimer = setTimeoutSpy.mock.calls.find(
      ([, delay]) => delay === 5000,
    )?.[0];
    expect(typeof staleTimer).toBe('function');
    rerender(renderCarousel(false));
    rerender(renderCarousel(true));
    act(() => {
      if (typeof staleTimer === 'function') staleTimer();
    });
    expect(mockSetPage).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(5000));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });

  it('ignores a queued timer when the carousel is pressed', () => {
    const setTimeoutSpy: jest.SpyInstance<
      ReturnType<typeof setTimeout>,
      Parameters<typeof setTimeout>
    > = jest.spyOn(globalThis, 'setTimeout');
    render(renderCarousel(true));
    const staleTimer = setTimeoutSpy.mock.calls.find(
      ([, delay]) => delay === 5000,
    )?.[0];
    expect(typeof staleTimer).toBe('function');
    act(() => mockPressIn?.());
    act(() => {
      if (typeof staleTimer === 'function') staleTimer();
    });
    expect(mockSetPage).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it('keeps the committed eligibility when a concurrent render suspends', () => {
    const pending = new Promise(() => undefined);
    function Blocker({ shouldSuspend }: { shouldSuspend: boolean }) {
      if (shouldSuspend) throw pending;
      return null;
    }
    const view = (enabled: boolean, shouldSuspend: boolean) => (
      <Suspense fallback={LOADING}>
        {renderCarousel(enabled)}
        <Blocker shouldSuspend={shouldSuspend} />
      </Suspense>
    );
    const { rerender } = render(view(true, false));
    act(() => {
      startTransition(() => rerender(view(false, true)));
    });
    act(() => jest.advanceTimersByTime(5000));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });

  it('waits for the inner drag to settle before starting a new interval', () => {
    render(renderCarousel(true));
    act(() => mockPagerStateChange?.('dragging'));
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockSetPage).not.toHaveBeenCalled();
    act(() => mockPagerStateChange?.('idle'));
    act(() => jest.advanceTimersByTime(4999));
    expect(mockSetPage).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });

  it('does not autoplay the single-banner configuration', () => {
    render(
      <Carousel
        data={ONE_ITEM}
        renderItem={renderItem}
        pageWidth={100}
        autoPlayInterval={5000}
        loop={false}
      />,
    );
    act(() => jest.advanceTimersByTime(15_000));
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('waits for layout before starting the first full interval', () => {
    render(
      <Carousel
        data={TWO_ITEMS}
        renderItem={renderItem}
        autoPlayInterval={5000}
      />,
    );
    act(() => jest.advanceTimersByTime(10_000));
    expect(mockSetPage).not.toHaveBeenCalled();
    act(() => mockLayout?.(200, 100));
    act(() => jest.advanceTimersByTime(4999));
    expect(mockSetPage).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });
});
