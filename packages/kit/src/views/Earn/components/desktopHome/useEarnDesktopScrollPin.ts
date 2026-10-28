import { useCallback, useEffect, useRef } from 'react';

import type { IElement } from '@onekeyhq/components';

import { LIST_FOLD_MS } from '../../utils/earnListMotion';

// A fold starts a frame or two after the press and an unfold under the
// element may run 250 ms; this covers both with room to spare
const PIN_MS = LIST_FOLD_MS + 250;
// The user taking the scroll over lets go of the pin
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown'] as const;

function findScroller(element: HTMLElement): HTMLElement | undefined {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return (
    (globalThis.document?.scrollingElement as HTMLElement | null) ?? undefined
  );
}

/**
 * Keeps an element where it is on screen while content above it changes
 * height, such as a list folding above the row or the "Show less" just
 * pressed: for a moment, every frame scrolls the page by however far the
 * element moved. Call it with the element right before the state change.
 * Web only (the desktop home); elsewhere it does nothing.
 */
export function useEarnDesktopScrollPin() {
  const stopRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => stopRef.current?.(), []);
  return useCallback(
    (target: IElement | null | undefined, durationMs: number = PIN_MS) => {
      stopRef.current?.();
      if (
        typeof HTMLElement === 'undefined' ||
        !(target instanceof HTMLElement)
      ) {
        return;
      }
      const scroller = findScroller(target);
      if (!scroller) {
        return;
      }
      const startTop = target.getBoundingClientRect().top;
      const endAt = performance.now() + durationMs;
      // The browser's own scroll anchoring would correct the same move again
      const anchoring = scroller.style.overflowAnchor;
      scroller.style.overflowAnchor = 'none';
      let frame = 0;
      const stop = () => {
        cancelAnimationFrame(frame);
        scroller.style.overflowAnchor = anchoring;
        USER_SCROLL_EVENTS.forEach((type) =>
          globalThis.removeEventListener(type, stop, true),
        );
        if (stopRef.current === stop) {
          stopRef.current = undefined;
        }
      };
      // Reading the position in the frame callback lays the page out at this
      // frame's point of the fold, so the correction is painted with it
      const step = () => {
        if (!target.isConnected) {
          stop();
          return;
        }
        const moved = target.getBoundingClientRect().top - startTop;
        if (Math.abs(moved) >= 0.5) {
          scroller.scrollBy({ top: moved, behavior: 'instant' });
        }
        if (performance.now() < endAt) {
          frame = requestAnimationFrame(step);
        } else {
          stop();
        }
      };
      USER_SCROLL_EVENTS.forEach((type) =>
        globalThis.addEventListener(type, stop, {
          capture: true,
          passive: true,
        }),
      );
      stopRef.current = stop;
      frame = requestAnimationFrame(step);
    },
    [],
  );
}
