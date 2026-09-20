/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import {
  resetDeviceSettledHeaderHeightForTest,
  useSettledHeaderHeight,
} from './useSettledHeaderHeight';

// OK-59958 / PR 12791 review P2. Two competing failures are covered here:
//   - revealing the body before the height is final lets paddingTop move under
//     visible content, which is the vertical jump this hook exists to remove;
//   - holding the body for as long as the height keeps moving blanked the page
//     for ~1s on a real device, so the hold is bounded and re-entry never waits.

const SETTLE_MS = 64;
const MAX_HOLD_MS = 250;
const opts = {
  enabled: true,
  settleMs: SETTLE_MS,
  maxHoldMs: MAX_HOLD_MS,
};

describe('useSettledHeaderHeight', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetDeviceSettledHeaderHeightForTest();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('holds until the height has been quiet for the settle window', () => {
    const { result } = renderHook(() => useSettledHeaderHeight(97.67, opts));

    expect(result.current.isSettled).toBe(false);

    act(() => {
      jest.advanceTimersByTime(SETTLE_MS - 1);
    });
    expect(result.current.isSettled).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isSettled).toBe(true);
    expect(result.current.paddingTop).toBe(97.67);
  });

  it('re-arms while the height is still moving, then reports the final value', () => {
    const { result, rerender } = renderHook(
      ({ height }) => useSettledHeaderHeight(height, opts),
      { initialProps: { height: 97.67 } },
    );

    act(() => {
      jest.advanceTimersByTime(SETTLE_MS - 10);
    });
    expect(result.current.isSettled).toBe(false);

    rerender({ height: 113 });
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.isSettled).toBe(false);

    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(result.current.isSettled).toBe(true);
    expect(result.current.paddingTop).toBe(113);
  });

  it('reveals at the cap when the height never stops moving', () => {
    const { result, rerender } = renderHook(
      ({ height }) => useSettledHeaderHeight(height, opts),
      { initialProps: { height: 90 } },
    );

    // Keep nudging the height so the settle window can never elapse
    for (let elapsed = 0; elapsed < MAX_HOLD_MS; elapsed += 50) {
      rerender({ height: 90 + elapsed });
      act(() => {
        jest.advanceTimersByTime(50);
      });
    }

    expect(result.current.isSettled).toBe(true);
  });

  it('never hides again once settled, even if a late height lands', () => {
    const { result, rerender } = renderHook(
      ({ height }) => useSettledHeaderHeight(height, opts),
      { initialProps: { height: 97.67 } },
    );

    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(result.current.isSettled).toBe(true);

    // Never hides again; the new height is adopted through the same quiet
    // window rather than snapping the padding under visible content
    rerender({ height: 113 });
    expect(result.current.isSettled).toBe(true);
    expect(result.current.paddingTop).toBe(97.67);

    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(result.current.isSettled).toBe(true);
    expect(result.current.paddingTop).toBe(113);
  });

  it('is settled from the first render on re-entry, with the known height', () => {
    const first = renderHook(
      ({ height }) => useSettledHeaderHeight(height, opts),
      {
        initialProps: { height: 113 },
      },
    );
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(first.result.current.isSettled).toBe(true);
    first.unmount();

    // Re-entry reports the estimate again for the first renders — it must
    // neither hide nor adopt it before the real height comes back
    const second = renderHook(
      ({ height }) => useSettledHeaderHeight(height, opts),
      { initialProps: { height: 97.67 } },
    );
    expect(second.result.current.isSettled).toBe(true);
    expect(second.result.current.paddingTop).toBe(113);

    second.rerender({ height: 113 });
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS * 2);
    });
    expect(second.result.current.isSettled).toBe(true);
    expect(second.result.current.paddingTop).toBe(113);
  });

  it('keeps the known height on re-entry while the measurement is late', () => {
    const first = renderHook(() => useSettledHeaderHeight(113, opts));
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    first.unmount();

    // A heavy first render can delay the native measurement past the settle
    // window; the estimate must not replace the known height meanwhile.
    const second = renderHook(
      ({ height }) => useSettledHeaderHeight(height, opts),
      { initialProps: { height: 97.67 } },
    );
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS * 4);
    });
    expect(second.result.current.paddingTop).toBe(113);

    second.rerender({ height: 113 });
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(second.result.current.paddingTop).toBe(113);
  });

  it('waits for the measured height instead of settling a placeholder', () => {
    const { result, rerender } = renderHook(
      ({ height }) =>
        useSettledHeaderHeight(height, {
          ...opts,
          estimatedHeaderHeight: 97.67,
        }),
      { initialProps: { height: 0 } },
    );

    // Header still hidden, then react-navigation's estimate: neither is a
    // measurement, so the settle window alone must not reveal the body.
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS * 2);
    });
    rerender({ height: 97.67 });
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(result.current.isSettled).toBe(false);

    rerender({ height: 113 });
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    expect(result.current.isSettled).toBe(true);
    expect(result.current.paddingTop).toBe(113);
  });

  it('reveals a placeholder at the cap without remembering it', () => {
    const first = renderHook(() =>
      useSettledHeaderHeight(97.67, {
        ...opts,
        estimatedHeaderHeight: 97.67,
      }),
    );
    act(() => {
      jest.advanceTimersByTime(MAX_HOLD_MS);
    });
    expect(first.result.current.isSettled).toBe(true);
    first.unmount();

    // The next mount has nothing trustworthy to start from yet.
    const second = renderHook(() =>
      useSettledHeaderHeight(97.67, {
        ...opts,
        estimatedHeaderHeight: 97.67,
      }),
    );
    expect(second.result.current.isSettled).toBe(false);
  });

  it('keeps the known height on re-entry through a hidden header and the estimate', () => {
    const first = renderHook(() => useSettledHeaderHeight(113, opts));
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS);
    });
    first.unmount();

    const second = renderHook(
      ({ height }) =>
        useSettledHeaderHeight(height, {
          ...opts,
          estimatedHeaderHeight: 97.67,
        }),
      { initialProps: { height: 0 } },
    );
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS * 2);
    });
    second.rerender({ height: 97.67 });
    act(() => {
      jest.advanceTimersByTime(SETTLE_MS * 4);
    });
    expect(second.result.current.isSettled).toBe(true);
    expect(second.result.current.paddingTop).toBe(113);
  });

  it('settles immediately when disabled, so other platforms never hide', () => {
    const { result } = renderHook(() =>
      useSettledHeaderHeight(44, { ...opts, enabled: false }),
    );

    expect(result.current.isSettled).toBe(true);
    expect(result.current.paddingTop).toBe(0);
  });
});
