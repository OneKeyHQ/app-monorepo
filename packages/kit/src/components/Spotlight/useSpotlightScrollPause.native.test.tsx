/** @jest-environment jsdom */

import type { PropsWithChildren, RefObject } from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';

import type { IElement } from '@onekeyhq/components';

import { SpotlightScrollStateContext } from './SpotlightScrollStateContext';
import { useSpotlightScrollPause } from './useSpotlightScrollPause.native';

import type { ISpotlightScrollState } from './SpotlightScrollStateContext';

let mockScrollY = { value: 0 };
let mockHasContext = true;
let mockQueueJS = false;
let mockQueuedJS: Array<() => void> = [];
let mockDeferSharedWrites = false;
let mockQueuedSharedWrites: Array<() => void> = [];
let mockDeferUI = false;
let mockQueuedUI: Array<() => void> = [];
let mockIsUIRuntime = false;
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

function mockExecuteUI(callback: () => void) {
  const previous = mockIsUIRuntime;
  mockIsUIRuntime = true;
  try {
    callback();
  } finally {
    mockIsUIRuntime = previous;
  }
}

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
    runOnUI: (callback: () => void) => () => {
      if (mockDeferUI) mockQueuedUI.push(() => mockExecuteUI(callback));
      else mockExecuteUI(callback);
    },
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
                mockExecuteUI(() => next.callback?.(true));
              }, next.delay);
            } else if (mockDeferSharedWrites && !mockIsUIRuntime) {
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
    mockDeferUI = false;
    mockQueuedUI = [];
    mockIsUIRuntime = false;
    mockBridgeCall.mockClear();
    mockDelay.mockClear();
    visibilityChange = jest.fn();
  });

  function scrollTo(offset: number) {
    const previous = mockPrepare();
    mockScrollY.value = offset;
    act(() => mockExecuteUI(() => mockReact(mockPrepare(), previous)));
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

  it('stays paused until the UI thread initializes and settles at the top', () => {
    mockDeferSharedWrites = true;
    mockDeferUI = true;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(visibilityChange.mock.calls).toEqual([[true]]);
    act(() => mockQueuedUI.splice(0).forEach((callback) => callback()));
    act(() => jest.advanceTimersByTime(149));
    expect(visibilityChange.mock.calls).toEqual([[true]]);
    act(() => jest.advanceTimersByTime(1));
    expect(visibilityChange.mock.calls).toEqual([[true], [false]]);
    expect(mockQueuedSharedWrites).toHaveLength(0);
  });

  it('reads the initial offset only on the UI thread', () => {
    const readRuntime = jest.fn<void, [boolean]>();
    mockScrollY = {
      get value() {
        readRuntime(mockIsUIRuntime);
        return 0;
      },
    };
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(readRuntime.mock.calls).toEqual([[true]]);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange.mock.calls).toEqual([[true], [false]]);
  });

  it('reads the latest offset when scrolling precedes UI initialization', () => {
    mockDeferSharedWrites = true;
    mockDeferUI = true;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    scrollTo(40);
    act(() => mockQueuedSharedWrites.splice(0).forEach((write) => write()));
    act(() => mockQueuedUI.splice(0).forEach((callback) => callback()));
    act(() => jest.advanceTimersByTime(200));
    expect(visibilityChange).not.toHaveBeenCalledWith(false);
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    mockBridgeCall.mockClear();
    scrollTo(0);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
    expect(mockBridgeCall.mock.calls).toEqual([[false]]);
  });

  it('waits for settling when the listener restarts as scrolling returns to the top', () => {
    mockScrollY.value = 40;
    const view = renderHook(
      ({ onScrollChange }) =>
        useSpotlightScrollPause(ref, true, onScrollChange),
      { initialProps: { onScrollChange: visibilityChange } },
    );
    scrollTo(0);
    act(() => jest.advanceTimersByTime(50));
    const nextVisibilityChange = jest.fn<void, [boolean]>();
    mockDeferUI = true;
    view.rerender({ onScrollChange: nextVisibilityChange });
    act(() => mockQueuedUI.splice(0).forEach((callback) => callback()));
    act(() => jest.advanceTimersByTime(149));
    expect(nextVisibilityChange).not.toHaveBeenCalledWith(false);
    act(() => jest.advanceTimersByTime(1));
    expect(nextVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it.each([0, -24])(
    'cancels initial settling if scrolling leaves the top from %s',
    (offset) => {
      mockScrollY.value = offset;
      renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
      act(() => jest.advanceTimersByTime(100));
      scrollTo(40);
      act(() => jest.advanceTimersByTime(200));
      expect(visibilityChange).not.toHaveBeenCalledWith(false);
      scrollTo(0);
      act(() => jest.advanceTimersByTime(149));
      expect(visibilityChange).not.toHaveBeenCalledWith(false);
      act(() => jest.advanceTimersByTime(1));
      expect(visibilityChange).toHaveBeenLastCalledWith(false);
    },
  );

  it('waits for settling again when re-enabled at the top', () => {
    const view = renderHook(
      ({ enabled }) => useSpotlightScrollPause(ref, enabled, visibilityChange),
      { initialProps: { enabled: true } },
    );
    act(() => jest.advanceTimersByTime(100));
    view.rerender({ enabled: false });
    view.rerender({ enabled: true });
    act(() => jest.advanceTimersByTime(149));
    expect(visibilityChange).not.toHaveBeenCalledWith(false);
    act(() => jest.advanceTimersByTime(1));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
  });

  it.each([null, undefined])(
    'restarts initial settling on the first bounce sample with previous=%s',
    (previous) => {
      renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
      act(() => jest.advanceTimersByTime(100));
      mockScrollY.value = -24;
      act(() => mockExecuteUI(() => mockReact(mockPrepare(), previous)));
      act(() => jest.advanceTimersByTime(149));
      expect(visibilityChange).not.toHaveBeenCalledWith(false);
      act(() => jest.advanceTimersByTime(1));
      expect(visibilityChange).toHaveBeenLastCalledWith(false);
      expect(mockBridgeCall.mock.calls).toEqual([[false]]);
    },
  );

  it('discards initialization queued before disable and re-enable', () => {
    mockDeferUI = true;
    mockQueueJS = true;
    const view = renderHook(
      ({ enabled }) => useSpotlightScrollPause(ref, enabled, visibilityChange),
      { initialProps: { enabled: true } },
    );
    act(() => mockQueuedUI.splice(0).forEach((callback) => callback()));
    act(() => jest.advanceTimersByTime(150));
    view.rerender({ enabled: false });
    mockScrollY.value = 40;
    view.rerender({ enabled: true });
    visibilityChange.mockClear();
    act(() => mockQueuedJS.splice(0).forEach((callback) => callback()));
    expect(visibilityChange).not.toHaveBeenCalled();
    act(() => mockQueuedUI.splice(0).forEach((callback) => callback()));
    act(() => mockQueuedJS.splice(0).forEach((callback) => callback()));
    expect(visibilityChange.mock.calls).toEqual([[true]]);
  });

  it.each([null, undefined, 40])(
    'pauses on a positive first sample even with previous=%s',
    (previous) => {
      renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
      act(() => jest.advanceTimersByTime(150));
      mockBridgeCall.mockClear();
      mockScrollY.value = 40;
      act(() => mockExecuteUI(() => mockReact(mockPrepare(), previous)));
      expect(visibilityChange).toHaveBeenLastCalledWith(true);
      expect(mockBridgeCall.mock.calls).toEqual([[true]]);
    },
  );

  it('keeps the guide paused at a restored nonzero offset', () => {
    mockScrollY.value = 100;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    visibilityChange.mockClear();
    mockBridgeCall.mockClear();
    for (let offset = 99; offset > 0; offset -= 1) scrollTo(offset);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).not.toHaveBeenCalled();
    expect(mockBridgeCall).not.toHaveBeenCalled();
    scrollTo(0);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
    expect(mockBridgeCall).toHaveBeenCalledTimes(1);
  });

  it('notifies JS only when pausing and settling back at the top', () => {
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    act(() => jest.advanceTimersByTime(150));
    mockBridgeCall.mockClear();
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
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
    mockBridgeCall.mockClear();
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
    visibilityChange.mockClear();
    mockBridgeCall.mockClear();
    scrollTo(0);
    act(() => jest.advanceTimersByTime(100));
    scrollTo(10);
    act(() => jest.advanceTimersByTime(200));
    expect(visibilityChange).not.toHaveBeenCalled();
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
    act(() => jest.advanceTimersByTime(150));
    mockQueueJS = true;
    scrollTo(20);
    scrollTo(0);
    act(() => jest.advanceTimersByTime(150));
    expect(mockQueuedJS).toHaveLength(2);
    const previousSessionCallbacks = mockQueuedJS.splice(0);
    view.rerender({ enabled: false });
    mockScrollY.value = 100;
    view.rerender({ enabled: true });
    visibilityChange.mockClear();
    act(() => previousSessionCallbacks.forEach((callback) => callback()));
    expect(visibilityChange).not.toHaveBeenCalled();
    act(() => mockQueuedJS.splice(0).forEach((callback) => callback()));
    expect(visibilityChange.mock.calls).toEqual([[true]]);
  });

  it('cancels settling and ignores queued callbacks after unmount', () => {
    const view = renderHook(() =>
      useSpotlightScrollPause(ref, true, visibilityChange),
    );
    act(() => jest.advanceTimersByTime(150));
    mockBridgeCall.mockClear();
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

// Native state already includes the owner-bound 150ms stabilization gate.
describe('Spotlight native Header state source', () => {
  const ref = { current: null } as RefObject<IElement | null>;
  let state: ISpotlightScrollState | null;
  const wrapper = ({ children }: PropsWithChildren) => (
    <SpotlightScrollStateContext.Provider value={state}>
      {children}
    </SpotlightScrollStateContext.Provider>
  );

  beforeEach(() => {
    jest.useFakeTimers();
    state = null;
    mockHasContext = true;
    mockScrollY = { value: 100 };
    mockDeferUI = false;
    mockQueueJS = false;
    mockQueuedJS = [];
    mockDelay.mockClear();
  });
  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps an unknown native source paused instead of falling back to Tabs', () => {
    const notify = jest.fn();
    renderHook(() => useSpotlightScrollPause(ref, true, notify), { wrapper });
    expect(notify.mock.calls).toEqual([[true]]);
    expect(mockPrepare()).toBeUndefined();
    expect(mockDelay).not.toHaveBeenCalled();
  });

  it('measures immediately after native settling without a second 150ms delay', () => {
    const notify = jest.fn();
    const view = renderHook(() => useSpotlightScrollPause(ref, true, notify), {
      wrapper,
    });
    state = { pageKey: 'Spot', headerSettledAtTop: true };
    view.rerender();
    expect(notify.mock.calls).toEqual([[true], [false]]);
    expect(mockPrepare()).toBeUndefined();
    expect(mockDelay).not.toHaveBeenCalled();
    state = { pageKey: 'Spot', headerSettledAtTop: false };
    view.rerender();
    expect(notify).toHaveBeenLastCalledWith(true);
  });

  it('uses the last native snapshot when qualification enables later', () => {
    state = { pageKey: 'Spot', headerSettledAtTop: true };
    const notify = jest.fn();
    const view = renderHook(
      ({ enabled }) => useSpotlightScrollPause(ref, enabled, notify),
      {
        wrapper,
        initialProps: { enabled: false },
      },
    );
    expect(notify).not.toHaveBeenCalled();
    view.rerender({ enabled: true });
    expect(notify.mock.calls).toEqual([[false]]);
    expect(mockDelay).not.toHaveBeenCalled();
  });

  it('notifies a new native owner even if its settled boolean is unchanged', () => {
    state = { pageKey: 'Spot', headerSettledAtTop: true };
    const notify = jest.fn();
    const view = renderHook(() => useSpotlightScrollPause(ref, true, notify), {
      wrapper,
    });
    state = { pageKey: 'Other', headerSettledAtTop: true };
    view.rerender();
    expect(notify.mock.calls).toEqual([[false], [false]]);
  });

  it('rejects queued legacy completion after switching to an unknown native owner', () => {
    mockScrollY = { value: 0 };
    mockQueueJS = true;
    const notify = jest.fn();
    const view = renderHook(() => useSpotlightScrollPause(ref, true, notify), {
      wrapper: ({ children }) => (
        <SpotlightScrollStateContext.Provider
          value={state === null ? undefined : state}
        >
          {children}
        </SpotlightScrollStateContext.Provider>
      ),
    });
    act(() => jest.advanceTimersByTime(150));
    const queued = mockQueuedJS.splice(0);
    state = { pageKey: 'Spot', headerSettledAtTop: false };
    view.rerender();
    notify.mockClear();
    act(() => queued.forEach((callback) => callback()));
    expect(notify).not.toHaveBeenCalled();
  });
});
