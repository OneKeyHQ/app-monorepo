/** @jest-environment jsdom */

import type { RefObject } from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';

import type { IElement } from '@onekeyhq/components';

import { useSpotlightScrollPause } from './useSpotlightScrollPause.native';

let mockScrollY = { value: 0 };
let mockHasContext = true;
let mockQueueJS = false;
let mockQueuedJS: Array<() => void> = [];
let mockDeferSharedWrites = false;
let mockQueuedSharedWrites: Array<() => void> = [];
const mockBridgeCall = jest.fn<void, [boolean]>();
const mockDelay = jest.fn();
let mockPrepare: () => number | undefined;
let mockReact: (
  current: number | undefined,
  previous: number | null | undefined,
) => void;

type IMockAnimation = {
  toValue: number;
  delay: number;
  callback?: (finished?: boolean) => void;
};
type IMockSharedValue = {
  value: number | boolean | IMockAnimation;
  cancel: () => void;
};

jest.mock(
  '@onekeyhq/components/src/composite/Tabs/CollapsibleTabContext',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      CollapsibleTabContext: React.createContext({
        get scrollYCurrent() {
          return mockHasContext ? mockScrollY : undefined;
        },
      }),
    };
  },
);

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ReduceMotion: { Never: 'never' },
    runOnJS: (callback: (paused: boolean) => void) => (paused: boolean) => {
      mockBridgeCall(paused);
      if (mockQueueJS) mockQueuedJS.push(() => callback(paused));
      else callback(paused);
    },
    useSharedValue: (initial: number | boolean) => {
      const ref = React.useRef<IMockSharedValue | null>(null);
      if (!ref.current) {
        let value = initial;
        let animation: IMockAnimation | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const cancel = () => {
          clearTimeout(timer);
          const previous = animation;
          animation = undefined;
          previous?.callback?.(false);
        };
        ref.current = {
          get value() {
            return value;
          },
          set value(next: number | boolean | IMockAnimation) {
            cancel();
            if (typeof next === 'object') {
              animation = next;
              timer = setTimeout(() => {
                value = next.toValue;
                animation = undefined;
                next.callback?.(true);
              }, next.delay);
            } else if (mockDeferSharedWrites) {
              mockQueuedSharedWrites.push(() => {
                value = next;
              });
            } else value = next;
          },
          cancel,
        };
      }
      return ref.current;
    },
    cancelAnimation: (shared: IMockSharedValue) => shared.cancel(),
    withTiming: (
      toValue: number,
      _config: { duration: number },
      callback: IMockAnimation['callback'],
    ): IMockAnimation => ({ toValue, delay: 0, callback }),
    withDelay: (
      delay: number,
      animation: IMockAnimation,
      reduceMotion: string,
    ): IMockAnimation => {
      mockDelay(delay, reduceMotion);
      return { ...animation, delay };
    },
    useAnimatedReaction: (
      prepare: typeof mockPrepare,
      reaction: typeof mockReact,
    ) => {
      mockPrepare = prepare;
      mockReact = reaction;
    },
  };
});

describe('Spotlight native scroll pause', () => {
  let visibilityChange: jest.Mock<void, [boolean]>;
  const ref = { current: null } as RefObject<IElement | null>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockScrollY = { value: 0 };
    mockHasContext = true;
    mockQueueJS = false;
    mockQueuedJS = [];
    mockDeferSharedWrites = false;
    mockQueuedSharedWrites = [];
    mockBridgeCall.mockClear();
    mockDelay.mockClear();
    visibilityChange = jest.fn();
  });

  function scrollTo(offset: number) {
    const previous = mockPrepare();
    mockScrollY.value = offset;
    act(() => mockReact(mockPrepare(), previous));
  }

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not read or subscribe to the scroll value when disabled', () => {
    renderHook(() => useSpotlightScrollPause(ref, false, visibilityChange));
    expect(mockPrepare()).toBeUndefined();
    expect(visibilityChange).not.toHaveBeenCalled();
  });

  it('initializes without reading back asynchronous main-to-UI writes', () => {
    mockDeferSharedWrites = true;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(visibilityChange.mock.calls).toEqual([[false]]);
    act(() => mockQueuedSharedWrites.forEach((write) => write()));
    expect(visibilityChange.mock.calls).toEqual([[false]]);
  });

  it('keeps the guide paused at a restored nonzero offset', () => {
    mockScrollY.value = 100;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    for (let offset = 99; offset > 0; offset -= 1) scrollTo(offset);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenCalledTimes(1);
    expect(mockBridgeCall).not.toHaveBeenCalled();
    scrollTo(0);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
    expect(mockBridgeCall).toHaveBeenCalledTimes(1);
  });

  it('notifies JS only when pausing and settling back at the top', () => {
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    for (let offset = 1; offset <= 60; offset += 1) scrollTo(offset);
    expect(mockBridgeCall.mock.calls).toEqual([[true]]);
    act(() => jest.advanceTimersByTime(200));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    scrollTo(0);
    act(() => jest.advanceTimersByTime(149));
    expect(mockBridgeCall.mock.calls).toEqual([[true]]);
    act(() => jest.advanceTimersByTime(1));
    expect(mockBridgeCall.mock.calls).toEqual([[true], [false]]);
    expect(mockDelay).toHaveBeenLastCalledWith(150, 'never');
  });

  it('accepts normalized inset/bounce offsets and waits for scrolling to settle', () => {
    mockScrollY.value = -24;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
    scrollTo(-12);
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    act(() => jest.advanceTimersByTime(100));
    scrollTo(-6);
    act(() => jest.advanceTimersByTime(149));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    act(() => jest.advanceTimersByTime(1));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
    expect(mockBridgeCall.mock.calls).toEqual([[true], [false]]);
  });

  it('cancels settling if scrolling moves away from the top', () => {
    mockScrollY.value = 20;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    scrollTo(0);
    act(() => jest.advanceTimersByTime(100));
    scrollTo(10);
    act(() => jest.advanceTimersByTime(200));
    expect(visibilityChange.mock.calls).toEqual([[true]]);
    expect(mockBridgeCall).not.toHaveBeenCalled();
  });

  it('cancels pending scroll completion when the guide is disabled', () => {
    const view = renderHook(
      ({ enabled }) => useSpotlightScrollPause(ref, enabled, visibilityChange),
      { initialProps: { enabled: true } },
    );
    scrollTo(20);
    scrollTo(0);
    view.rerender({ enabled: false });
    visibilityChange.mockClear();
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).not.toHaveBeenCalled();
    expect(mockPrepare()).toBeUndefined();
  });

  it('ignores queued callbacks from a previous enabled session', () => {
    const view = renderHook(
      ({ enabled }) => useSpotlightScrollPause(ref, enabled, visibilityChange),
      { initialProps: { enabled: true } },
    );
    mockQueueJS = true;
    scrollTo(20);
    scrollTo(0);
    act(() => jest.advanceTimersByTime(150));
    expect(mockQueuedJS).toHaveLength(2);
    view.rerender({ enabled: false });
    mockScrollY.value = 100;
    view.rerender({ enabled: true });
    visibilityChange.mockClear();
    act(() => mockQueuedJS.forEach((callback) => callback()));
    expect(visibilityChange).not.toHaveBeenCalled();
  });

  it('cancels settling and ignores queued callbacks after unmount', () => {
    const view = renderHook(() =>
      useSpotlightScrollPause(ref, true, visibilityChange),
    );
    mockQueueJS = true;
    scrollTo(-12);
    view.unmount();
    visibilityChange.mockClear();
    act(() => jest.advanceTimersByTime(150));
    act(() => mockQueuedJS.forEach((callback) => callback()));
    expect(visibilityChange).not.toHaveBeenCalled();
    expect(mockBridgeCall.mock.calls).toEqual([[true]]);
  });

  it('stays paused when the scroll context is unavailable', () => {
    mockHasContext = false;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(mockPrepare()).toBeUndefined();
    expect(visibilityChange.mock.calls).toEqual([[true]]);
    expect(mockBridgeCall).not.toHaveBeenCalled();
  });
});
