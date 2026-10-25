/**
 * @jest-environment jsdom
 */
import { useState } from 'react';

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

  it('accepts native dismiss completion before the requested close commits', () => {
    const onAnimationComplete = jest.fn();
    const { result } = renderHook(() => {
      const [isOpen, setIsOpen] = useState(true);
      return {
        lifecycle: useNativePortalLifecycle({
          isOpen,
          sheetProps: { onAnimationComplete },
        }),
        requestClose: () => setIsOpen(false),
      };
    });
    act(() => jest.advanceTimersByTime(16));
    expect(result.current.lifecycle.popoverOpen).toBe(true);

    act(() => {
      const { lifecycle, requestClose } = result.current;
      requestClose();
      lifecycle.resolvedSheetProps?.onAnimationComplete?.({ open: false });
    });

    expect(result.current.lifecycle.isNativePortalMounted).toBe(false);
    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
    expect(onAnimationComplete).toHaveBeenCalledWith({ open: false });
    expect(jest.getTimerCount()).toBe(0);

    act(() => {
      result.current.lifecycle.resolvedSheetProps?.onAnimationComplete?.({
        open: false,
      });
      jest.advanceTimersByTime(5500);
    });
    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
    expect(result.current.lifecycle.isNativePortalMounted).toBe(false);
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

  it('restores a controlled sheet when its owner ignores a native close', () => {
    const onAnimationComplete = jest.fn();
    const { result } = renderHook(() =>
      useNativePortalLifecycle({
        isOpen: true,
        sheetProps: { onAnimationComplete },
      }),
    );
    act(() => jest.advanceTimersByTime(16));
    act(() =>
      result.current.resolvedSheetProps?.onAnimationComplete?.({ open: false }),
    );
    expect(result.current.isNativePortalMounted).toBe(true);
    expect(onAnimationComplete).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(16));
    expect(result.current.popoverOpen).toBe(true);
    expect(result.current.isNativePortalMounted).toBe(true);
  });

  it('keeps a reopened portal when an old exit uses the latest callback', () => {
    const { result, rerender } = openPopover();
    rerender({ isOpen: false });
    rerender({ isOpen: true });
    act(() => jest.advanceTimersByTime(16));
    act(() =>
      result.current.resolvedSheetProps?.onAnimationComplete?.({ open: false }),
    );
    expect(result.current.isNativePortalMounted).toBe(true);
    act(() => jest.advanceTimersByTime(16));
    expect(result.current.popoverOpen).toBe(true);
    rerender({ isOpen: false });
    expect(result.current.isNativePortalMounted).toBe(true);
    act(() =>
      result.current.resolvedSheetProps?.onAnimationComplete?.({ open: false }),
    );
    expect(result.current.isNativePortalMounted).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleans up a delayed controlled close before a replacement sheet opens', () => {
    const onAnimationComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useNativePortalLifecycle({
          isOpen,
          sheetProps: { onAnimationComplete },
        }),
      { initialProps: { isOpen: true } },
    );
    act(() => jest.advanceTimersByTime(16));
    act(() =>
      result.current.resolvedSheetProps?.onAnimationComplete?.({ open: false }),
    );
    expect(result.current.isNativePortalMounted).toBe(true);
    rerender({ isOpen: false });
    expect(result.current.isNativePortalMounted).toBe(false);
    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
    expect(onAnimationComplete).toHaveBeenCalledWith({ open: false });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores the previous exit while a reopened popover closes again', () => {
    const onAnimationComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useNativePortalLifecycle({
          isOpen,
          sheetProps: { onAnimationComplete },
        }),
      { initialProps: { isOpen: true } },
    );
    act(() => jest.advanceTimersByTime(16));
    rerender({ isOpen: false });
    const previousClose =
      result.current.resolvedSheetProps?.onAnimationComplete;
    rerender({ isOpen: true });
    act(() => jest.advanceTimersByTime(16));
    rerender({ isOpen: false });

    act(() => previousClose?.({ open: false }));
    expect(result.current.isNativePortalMounted).toBe(true);
    expect(onAnimationComplete).not.toHaveBeenCalled();

    act(() =>
      result.current.resolvedSheetProps?.onAnimationComplete?.({ open: false }),
    );
    expect(result.current.isNativePortalMounted).toBe(false);
    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
  });

  it('cancels pre-presentation opens without waiting for a missing exit event', () => {
    const onAnimationComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useNativePortalLifecycle({
          isOpen,
          sheetProps: { onAnimationComplete },
        }),
      { initialProps: { isOpen: true } },
    );
    rerender({ isOpen: false });
    act(() => jest.advanceTimersByTime(16));
    expect(result.current.isNativePortalMounted).toBe(false);
    expect(result.current.popoverOpen).toBe(false);
    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
    expect(onAnimationComplete).toHaveBeenCalledWith({ open: false });
  });

  it('falls back when native never reports completion and clears timers on unmount', () => {
    const { result, rerender, unmount } = openPopover();
    rerender({ isOpen: false });
    act(() => jest.advanceTimersByTime(1352));
    expect(result.current.isNativePortalMounted).toBe(true);
    act(() => jest.advanceTimersByTime(4148));
    expect(result.current.isNativePortalMounted).toBe(false);
    rerender({ isOpen: true });
    act(() => jest.advanceTimersByTime(16));
    rerender({ isOpen: false });
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('forwards an abnormal exit fallback to the caller once', () => {
    const onAnimationComplete = jest.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) =>
        useNativePortalLifecycle({
          isOpen,
          sheetProps: { onAnimationComplete },
        }),
      { initialProps: { isOpen: true } },
    );
    act(() => jest.advanceTimersByTime(16));
    rerender({ isOpen: false });
    act(() => jest.advanceTimersByTime(5500));
    expect(result.current.isNativePortalMounted).toBe(false);
    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
    expect(onAnimationComplete).toHaveBeenCalledWith({ open: false });
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
