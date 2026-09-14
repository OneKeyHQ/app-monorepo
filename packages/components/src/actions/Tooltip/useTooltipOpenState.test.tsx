/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { closeAllTooltips } from './tooltipRegistry';
import { useTooltipOpenState } from './useTooltipOpenState';

const mousePress = { pointerType: 'mouse' };
const touchPress = { pointerType: 'touch' };

describe('useTooltipOpenState', () => {
  it('opens and closes when the floating controller reports open changes', () => {
    const { result } = renderHook(() => useTooltipOpenState({}));

    act(() => result.current.handleOpenChange(true));
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.handleOpenChange(false));
    expect(result.current.isOpen).toBe(false);
  });

  it('a mouse press on the trigger closes the tooltip', () => {
    const { result } = renderHook(() => useTooltipOpenState({}));
    act(() => result.current.handleOpenChange(true));

    act(() => result.current.handleTriggerPointerDown(mousePress));

    expect(result.current.isOpen).toBe(false);
  });

  it('after a mouse press the tooltip stays closed until the pointer leaves the trigger', () => {
    const { result } = renderHook(() => useTooltipOpenState({}));
    act(() => result.current.handleOpenChange(true));
    act(() => result.current.handleTriggerPointerDown(mousePress));

    act(() => result.current.handleOpenChange(true));
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.handleTriggerMouseLeave());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.handleOpenChange(true));
    expect(result.current.isOpen).toBe(true);
  });

  it('a touch press does not close the tooltip', () => {
    const { result } = renderHook(() => useTooltipOpenState({}));
    act(() => result.current.handleOpenChange(true));

    act(() => result.current.handleTriggerPointerDown(touchPress));

    expect(result.current.isOpen).toBe(true);
  });

  it('closeAllTooltips closes an open tooltip', () => {
    const { result } = renderHook(() => useTooltipOpenState({}));
    act(() => result.current.handleOpenChange(true));

    act(() => closeAllTooltips());

    expect(result.current.isOpen).toBe(false);
  });

  it('a tooltip closed by closeAllTooltips can reopen on the next hover', () => {
    const { result } = renderHook(() => useTooltipOpenState({}));
    act(() => result.current.handleOpenChange(true));
    act(() => closeAllTooltips());

    act(() => result.current.handleOpenChange(true));

    expect(result.current.isOpen).toBe(true);
  });

  it('an unmounted tooltip is not closed by closeAllTooltips', () => {
    const { result, unmount } = renderHook(() => useTooltipOpenState({}));
    act(() => result.current.handleOpenChange(true));
    unmount();

    expect(() => closeAllTooltips()).not.toThrow();
  });

  describe('hovering mode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('a mouse press closes a hover-opened tooltip and blocks re-hover until leave', () => {
      const { result } = renderHook(() =>
        useTooltipOpenState({ hovering: true }),
      );
      act(() => result.current.handleTriggerMouseEnter());
      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(result.current.isOpen).toBe(true);

      act(() => result.current.handleTriggerPointerDown(mousePress));
      expect(result.current.isOpen).toBe(false);

      act(() => result.current.handleTriggerMouseEnter());
      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(result.current.isOpen).toBe(false);

      act(() => result.current.handleTriggerMouseLeave());
      expect(result.current.isOpen).toBe(false);
      act(() => {
        jest.advanceTimersByTime(300);
      });
      act(() => result.current.handleTriggerMouseEnter());
      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(result.current.isOpen).toBe(true);
    });

    it('closeAllTooltips closes a hover-opened tooltip', () => {
      const { result } = renderHook(() =>
        useTooltipOpenState({ hovering: true }),
      );
      act(() => result.current.handleTriggerMouseEnter());
      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(result.current.isOpen).toBe(true);

      act(() => closeAllTooltips());

      expect(result.current.isOpen).toBe(false);
    });
  });
});
