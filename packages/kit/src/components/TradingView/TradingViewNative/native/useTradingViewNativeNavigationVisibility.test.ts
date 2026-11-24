/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION } from '../chartConstants';

import {
  TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY,
  useTradingViewNativeNavigationVisibility,
} from './useTradingViewNativeNavigationVisibility';

type IMockHandler = (...args: unknown[]) => void;

interface IMockTapGesture {
  enabled: jest.Mock;
  handlers: Record<string, IMockHandler>;
  maxDistance: jest.Mock;
  maxDuration: jest.Mock;
}

const mockTapGestures: IMockTapGesture[] = [];

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Tap: jest.fn(() => {
      const handlers: Record<string, IMockHandler> = {};
      const gesture = { handlers } as IMockTapGesture & Record<string, unknown>;
      for (const method of [
        'enabled',
        'maxDistance',
        'maxDuration',
        'onBegin',
        'onEnd',
      ]) {
        gesture[method] = jest.fn((argument: unknown) => {
          if (method.startsWith('on')) {
            handlers[method] = argument as IMockHandler;
          }
          return gesture;
        });
      }
      mockTapGestures.push(gesture);
      return gesture;
    }),
  },
}));

let mockIsScreenReaderEnabled = false;
let mockScreenReaderQueryFails = false;
let mockScreenReaderListener: ((enabled: boolean) => void) | undefined;

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    isScreenReaderEnabled: () =>
      mockScreenReaderQueryFails
        ? Promise.reject(new Error('unavailable'))
        : Promise.resolve(mockIsScreenReaderEnabled),
    addEventListener: (
      _event: string,
      listener: (enabled: boolean) => void,
    ) => {
      mockScreenReaderListener = listener;
      return { remove: () => undefined };
    },
  },
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: IMockHandler, ...args: unknown[]) =>
    callback(...args),
}));

function renderVisibility(enabled = true) {
  const hook = renderHook(
    ({ isEnabled }: { isEnabled: boolean }) =>
      useTradingViewNativeNavigationVisibility(isEnabled),
    { initialProps: { isEnabled: enabled } },
  );
  const tap = (success = true) =>
    act(() => {
      const { handlers } = hook.result.current.tapGesture as unknown as {
        handlers: Record<string, IMockHandler>;
      };
      handlers.onBegin?.();
      handlers.onEnd?.({}, success);
    });
  return { ...hook, tap };
}

describe('useTradingViewNativeNavigationVisibility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTapGestures.length = 0;
    mockIsScreenReaderEnabled = false;
    mockScreenReaderQueryFails = false;
    mockScreenReaderListener = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays hidden until the chart is tapped', () => {
    const { result, tap } = renderVisibility();
    expect(result.current.isVisible).toBe(false);

    tap(false);
    expect(result.current.isVisible).toBe(false);

    tap();
    expect(result.current.isVisible).toBe(true);
  });

  it('hides after the idle delay and shows again on the next tap', () => {
    const { result, tap } = renderVisibility();
    tap();

    act(() => {
      jest.advanceTimersByTime(TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY);
    });
    expect(result.current.isVisible).toBe(false);

    tap();
    expect(result.current.isVisible).toBe(true);
  });

  it.each(['tap', 'button press'] as const)(
    'restarts the idle delay after a %s',
    (activity) => {
      const { result, tap } = renderVisibility();
      tap();
      act(() => {
        jest.advanceTimersByTime(
          TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY - 1000,
        );
      });

      if (activity === 'tap') tap();
      else act(() => result.current.handleControlPress());
      act(() => {
        jest.advanceTimersByTime(
          TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY - 1,
        );
      });
      expect(result.current.isVisible).toBe(true);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current.isVisible).toBe(false);
    },
  );

  it('hides at once when the chart is dragged', () => {
    const { result, tap } = renderVisibility();
    tap();

    act(() => result.current.handleChartDragStart());
    expect(result.current.isVisible).toBe(false);

    act(() => {
      jest.advanceTimersByTime(TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY);
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('does not show when the touch that dragged lifts as a tap', () => {
    const { result } = renderVisibility();
    const { handlers } = result.current.tapGesture as unknown as {
      handlers: Record<string, IMockHandler>;
    };

    act(() => {
      handlers.onBegin?.();
      result.current.handleChartDragStart();
      handlers.onEnd?.({}, true);
    });
    expect(result.current.isVisible).toBe(false);

    // A new touch is judged on its own.
    act(() => {
      handlers.onBegin?.();
      handlers.onEnd?.({}, true);
    });
    expect(result.current.isVisible).toBe(true);
  });

  it('stays hidden and disables the tap while navigation is off', () => {
    const { result, rerender, tap } = renderVisibility();
    tap();
    expect(result.current.isVisible).toBe(true);

    rerender({ isEnabled: false });
    expect(result.current.isVisible).toBe(false);
    expect(mockTapGestures.at(-1)?.enabled).toHaveBeenCalledWith(false);
  });

  it('treats only short touches as taps', () => {
    renderVisibility();
    expect(mockTapGestures.at(-1)?.maxDistance).toHaveBeenCalledWith(10);
  });

  it('does not treat a hold that starts the crosshair as a tap', () => {
    renderVisibility();
    expect(mockTapGestures.at(-1)?.maxDuration).toHaveBeenCalledWith(
      TRADING_VIEW_NATIVE_CROSSHAIR_LONG_PRESS_DURATION,
    );
  });

  it('keeps the buttons visible while a screen reader is on', async () => {
    mockIsScreenReaderEnabled = true;
    const { result } = renderVisibility();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(TRADING_VIEW_NATIVE_NAVIGATION_IDLE_HIDE_DELAY);
    });
    expect(result.current.isVisible).toBe(true);

    act(() => mockScreenReaderListener?.(false));
    expect(result.current.isVisible).toBe(false);
  });

  it('falls back to tap-controlled buttons when the screen reader query fails', async () => {
    mockScreenReaderQueryFails = true;
    const { result, tap } = renderVisibility();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isVisible).toBe(false);

    tap();
    expect(result.current.isVisible).toBe(true);
  });

  it('keeps screen reader visibility behind the navigation setting', async () => {
    mockIsScreenReaderEnabled = true;
    const { result } = renderVisibility(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isVisible).toBe(false);
  });
});
