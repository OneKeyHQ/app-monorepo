/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
/* cspell:ignore hoverable */
import { useState } from 'react';

import { act, fireEvent, renderHook } from '@testing-library/react';

import { useHoverOpen } from './anchoredPopover';

import type { IPopoverHoverable } from './anchoredPopover';

const HOVER_OPTIONS = { delay: { open: 250 } };

function renderHover(hoverable: IPopoverHoverable = HOVER_OPTIONS) {
  const trigger = document.createElement('button');
  const panel = document.createElement('div');
  const triggerRef = { current: trigger };
  const onOpen = jest.fn();
  const onClose = jest.fn();
  const initialProps: {
    hoverable: IPopoverHoverable | undefined;
    panel: HTMLDivElement | null;
  } = { hoverable, panel: null };
  const view = renderHook(
    (props: typeof initialProps) => {
      const [open, setOpen] = useState(false);
      useHoverOpen({
        ...props,
        triggerRef,
        open,
        onOpen: () => {
          onOpen();
          setOpen(true);
        },
        onClose: () => {
          onClose();
          setOpen(false);
        },
      });
      return open;
    },
    { initialProps },
  );
  return { ...view, trigger, panel, onOpen, onClose };
}

function advance(ms: number) {
  act(() => jest.advanceTimersByTime(ms));
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('waits for the configured open delay', () => {
  const { trigger, result } = renderHover();
  fireEvent.mouseEnter(trigger);
  advance(249);
  expect(result.current).toBe(false);
  advance(1);
  expect(result.current).toBe(true);
});

it('opens without a delay when hoverable is true', () => {
  const { trigger, result } = renderHover(true);
  fireEvent.mouseEnter(trigger);
  advance(0);
  expect(result.current).toBe(true);
});

it('cancels opening when the pointer leaves before the delay', () => {
  const { trigger, onOpen } = renderHover();
  fireEvent.mouseEnter(trigger);
  advance(100);
  fireEvent.mouseLeave(trigger);
  advance(250);
  expect(onOpen).not.toHaveBeenCalled();
});

it('reopens after reentering the trigger during the old panel exit', () => {
  const { trigger, panel, result, rerender, onOpen } = renderHover();
  fireEvent.mouseEnter(trigger);
  advance(250);
  rerender({ hoverable: HOVER_OPTIONS, panel });
  expect(result.current).toBe(true);

  fireEvent.mouseLeave(trigger);
  advance(100);
  expect(result.current).toBe(false);

  // Reenter 50ms into the 150ms exit, before the old panel unmounts.
  advance(50);
  fireEvent.mouseEnter(trigger);
  advance(100);
  rerender({ hoverable: HOVER_OPTIONS, panel: null });
  advance(149);
  expect(result.current).toBe(false);
  advance(1);
  expect(result.current).toBe(true);
  expect(onOpen).toHaveBeenCalledTimes(2);
});

it('keeps the popover open while moving from the trigger into the panel', () => {
  const { trigger, panel, result, rerender } = renderHover();
  fireEvent.mouseEnter(trigger);
  advance(250);
  rerender({ hoverable: HOVER_OPTIONS, panel });

  fireEvent.mouseLeave(trigger);
  advance(50);
  fireEvent.mouseEnter(panel);
  advance(250);
  expect(result.current).toBe(true);

  fireEvent.mouseLeave(panel);
  advance(99);
  expect(result.current).toBe(true);
  advance(1);
  expect(result.current).toBe(false);
});

it('cancels pending opening when hover is disabled', () => {
  const { trigger, rerender, onOpen } = renderHover();
  fireEvent.mouseEnter(trigger);
  advance(100);
  rerender({ hoverable: false, panel: null });
  advance(250);
  fireEvent.mouseEnter(trigger);
  advance(250);
  expect(onOpen).not.toHaveBeenCalled();
});

it('cleans up pending opening and listeners on unmount', () => {
  const { trigger, unmount, onOpen } = renderHover();
  fireEvent.mouseEnter(trigger);
  advance(100);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  fireEvent.mouseEnter(trigger);
  advance(250);
  expect(onOpen).not.toHaveBeenCalled();
});
