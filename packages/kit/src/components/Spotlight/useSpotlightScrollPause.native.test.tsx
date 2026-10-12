/** @jest-environment jsdom */

import type { RefObject } from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';

import type { IElement } from '@onekeyhq/components';

import { useSpotlightScrollPause } from './useSpotlightScrollPause.native';

let mockScrollY = { value: 0 };
let mockPrepare: () => number | undefined;
let mockReact: (
  current: number | undefined,
  previous: number | null | undefined,
) => void;

jest.mock(
  '@onekeyhq/components/src/composite/Tabs/CollapsibleTabContext',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      CollapsibleTabContext: React.createContext({
        get scrollYCurrent() {
          return mockScrollY;
        },
      }),
    };
  },
);

jest.mock('react-native-reanimated', () => ({
  runOnJS: (callback: (atTop: boolean) => void) => callback,
  useAnimatedReaction: (
    prepare: typeof mockPrepare,
    reaction: typeof mockReact,
  ) => {
    mockPrepare = prepare;
    mockReact = reaction;
  },
}));

describe('Spotlight native scroll pause', () => {
  let visibilityChange: jest.Mock<void, [boolean]>;
  const ref = { current: null } as RefObject<IElement | null>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockScrollY = { value: 0 };
    visibilityChange = jest.fn();
  });

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

  it('keeps the guide paused at a restored nonzero offset', () => {
    mockScrollY.value = 100;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    act(() => mockReact(80, 100));
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    act(() => mockReact(0, 80));
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('accepts normalized inset/bounce offsets and waits for scrolling to settle', () => {
    mockScrollY.value = -24;
    renderHook(() => useSpotlightScrollPause(ref, true, visibilityChange));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
    act(() => mockReact(-12, -24));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    act(() => jest.advanceTimersByTime(149));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    act(() => jest.advanceTimersByTime(1));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('cancels pending scroll completion when the guide is disabled', () => {
    const view = renderHook(
      ({ enabled }) => useSpotlightScrollPause(ref, enabled, visibilityChange),
      { initialProps: { enabled: true } },
    );
    act(() => mockReact(0, 20));
    view.rerender({ enabled: false });
    visibilityChange.mockClear();
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).not.toHaveBeenCalled();
    expect(mockPrepare()).toBeUndefined();
  });
});
