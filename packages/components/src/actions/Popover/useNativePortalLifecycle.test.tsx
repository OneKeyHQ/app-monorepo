/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useNativePortalLifecycle } from './useNativePortalLifecycle.native';

describe('native popover exit lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function openPopover() {
    const hook = renderHook(
      ({ isOpen }) => useNativePortalLifecycle({ isOpen }),
      { initialProps: { isOpen: true } },
    );
    act(() => jest.advanceTimersByTime(16));
    expect(hook.result.current.popoverOpen).toBe(true);
    return hook;
  }

  it('retains an ordinary popover until its exit completes', () => {
    const { result, rerender } = openPopover();
    rerender({ isOpen: false });

    expect(result.current.popoverOpen).toBe(false);
    expect(result.current.isNativePortalMounted).toBe(true);
    act(() => jest.advanceTimersByTime(300));
    expect(result.current.isNativePortalMounted).toBe(true);

    act(() =>
      result.current.resolvedSheetProps?.onAnimationComplete?.({ open: false }),
    );
    expect(result.current.isNativePortalMounted).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not unmount a reopened popover on a previous close callback', () => {
    const { result, rerender } = openPopover();
    rerender({ isOpen: false });
    const previousClose =
      result.current.resolvedSheetProps?.onAnimationComplete;
    rerender({ isOpen: true });
    act(() => jest.advanceTimersByTime(16));
    act(() => previousClose?.({ open: false }));
    act(() => jest.advanceTimersByTime(1000));

    expect(result.current.popoverOpen).toBe(true);
    expect(result.current.isNativePortalMounted).toBe(true);
  });

  it('cancels pre-presentation opens without waiting for a missing exit event', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useNativePortalLifecycle({ isOpen }),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false });
    act(() => jest.advanceTimersByTime(16));
    expect(result.current.isNativePortalMounted).toBe(false);
    expect(result.current.popoverOpen).toBe(false);
  });

  it('falls back when native never reports completion and clears timers on unmount', () => {
    const { result, rerender, unmount } = openPopover();
    rerender({ isOpen: false });
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current.isNativePortalMounted).toBe(false);
    rerender({ isOpen: true });
    act(() => jest.advanceTimersByTime(16));
    rerender({ isOpen: false });
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('supports repeated open and close cycles and forwards completion', () => {
    const onAnimationComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useNativePortalLifecycle({
          isOpen,
          sheetProps: { onAnimationComplete },
        }),
      { initialProps: { isOpen: false } },
    );
    for (let index = 0; index < 5; index += 1) {
      rerender({ isOpen: true });
      act(() => jest.advanceTimersByTime(16));
      expect(result.current.popoverOpen).toBe(true);
      rerender({ isOpen: false });
      act(() =>
        result.current.resolvedSheetProps?.onAnimationComplete?.({
          open: false,
        }),
      );
      expect(result.current.isNativePortalMounted).toBe(false);
    }
    expect(onAnimationComplete).toHaveBeenCalledTimes(5);
    expect(jest.getTimerCount()).toBe(0);
  });
});
