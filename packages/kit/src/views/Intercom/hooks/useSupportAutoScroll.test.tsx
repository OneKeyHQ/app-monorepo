/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useSupportAutoScroll } from './useSupportAutoScroll';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const layout = {
  nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 500 } },
} as LayoutChangeEvent;
const scroll = (offset: number, height = 1500) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 400, height },
      layoutMeasurement: { width: 400, height: 500 },
    },
  }) as NativeSyntheticEvent<NativeScrollEvent>;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it.each(['content-first', 'layout-first'])(
  'opens at the latest message when measurements arrive %s',
  (order) => {
    const scrollToEnd = jest.fn();
    const ref = { current: { scrollToEnd } };
    const { result } = renderHook(() => useSupportAutoScroll(ref, true));
    act(() => {
      if (order === 'content-first')
        result.current.scrollProps.onContentSizeChange(400, 1500);
      else result.current.scrollProps.onLayout(layout);
      result.current.scrollProps.onScroll(scroll(0));
      jest.advanceTimersByTime(32);
    });
    expect(scrollToEnd).not.toHaveBeenCalled();
    act(() => {
      if (order === 'content-first')
        result.current.scrollProps.onLayout(layout);
      else result.current.scrollProps.onContentSizeChange(400, 1500);
      jest.advanceTimersByTime(32);
    });
    expect(scrollToEnd).toHaveBeenLastCalledWith({ animated: false });
  },
);

it('follows growing content, preserves a manual upward scroll and resumes after sending', () => {
  const scrollToEnd = jest.fn();
  const ref = { current: { scrollToEnd } };
  const { result } = renderHook(() => useSupportAutoScroll(ref, true));
  act(() => {
    result.current.scrollProps.onLayout(layout);
    result.current.scrollProps.onContentSizeChange(400, 1500);
    jest.advanceTimersByTime(32);
    result.current.scrollProps.onScroll(scroll(1000));
  });
  scrollToEnd.mockClear();
  act(() => {
    result.current.scrollProps.onScroll(scroll(1000, 1900));
    result.current.scrollProps.onContentSizeChange(400, 1900);
    jest.advanceTimersByTime(32);
    result.current.scrollProps.onScroll(scroll(1400, 1900));
  });
  expect(scrollToEnd).toHaveBeenCalledTimes(1);
  scrollToEnd.mockClear();
  act(() => {
    result.current.scrollProps.onScroll(scroll(500, 1900));
    result.current.scrollProps.onContentSizeChange(400, 2300);
    result.current.scrollProps.onLayout(layout);
    jest.advanceTimersByTime(32);
  });
  expect(scrollToEnd).not.toHaveBeenCalled();
  act(() => {
    result.current.followLatest();
    jest.advanceTimersByTime(32);
  });
  expect(scrollToEnd).toHaveBeenCalledTimes(1);
});

it('cancels queued scrolling when a native drag starts or the screen is disabled', () => {
  const scrollToEnd = jest.fn();
  const ref = { current: { scrollToEnd } };
  const { result, rerender } = renderHook(
    ({ enabled }) => useSupportAutoScroll(ref, enabled),
    { initialProps: { enabled: true } },
  );
  act(() => {
    result.current.scrollProps.onLayout(layout);
    result.current.scrollProps.onContentSizeChange(400, 1500);
    result.current.scrollProps.onScrollBeginDrag();
    jest.advanceTimersByTime(32);
  });
  expect(scrollToEnd).not.toHaveBeenCalled();
  act(() => result.current.followLatest());
  rerender({ enabled: false });
  act(() => jest.advanceTimersByTime(32));
  expect(scrollToEnd).not.toHaveBeenCalled();
});
