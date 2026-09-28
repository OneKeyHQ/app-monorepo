import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Gap between centered content and the keyboard; matches native. */
export const KEYBOARD_MARGIN = 16;

/**
 * How far to lift overlay content above the software keyboard (>= 0), the
 * same rule as iOS and Android: a sheet until its bottom clears the
 * keyboard, other content until its bottom is `KEYBOARD_MARGIN` above it,
 * never above the top edge. Full-window content never moves.
 */
export function computeKeyboardShift({
  keyboardTop,
  contentTop,
  contentBottom,
  isSheet,
  safeTop = 0,
}: {
  keyboardTop: number | undefined;
  contentTop: number;
  contentBottom: number;
  isSheet: boolean;
  safeTop?: number;
}): number {
  if (keyboardTop === undefined) {
    return 0;
  }
  const needed = isSheet
    ? contentBottom - keyboardTop
    : contentBottom + KEYBOARD_MARGIN - keyboardTop;
  const room = contentTop - safeTop;
  return Math.max(0, Math.min(needed, room));
}

/**
 * Vertical extent of the rendered children of the full-window React root,
 * relative to the content wrapper, from layout offsets (no transforms).
 */
function layoutExtent(
  content: HTMLElement | null,
): { top: number; bottom: number } | undefined {
  const root = content?.firstElementChild as HTMLElement | null | undefined;
  if (!root) {
    return undefined;
  }
  const children = Array.from(root.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  if (children.length === 0) {
    return undefined;
  }
  return {
    top: Math.min(...children.map((c) => root.offsetTop + c.offsetTop)),
    bottom: Math.max(
      ...children.map((c) => root.offsetTop + c.offsetTop + c.offsetHeight),
    ),
  };
}

/**
 * Mobile browsers shrink the visual viewport for the keyboard while fixed
 * layers keep the layout viewport; lift the entry's keyboard layer by the
 * covered part.
 */
export function useKeyboardShift({
  layerRef,
  sheetRef,
  contentRef,
  isSheet,
  enabled,
}: {
  layerRef: RefObject<HTMLDivElement | null>;
  sheetRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  isSheet: boolean;
  enabled: boolean;
}) {
  const shiftRef = useRef(0);

  useEffect(() => {
    const viewport = globalThis.visualViewport;
    const layer = layerRef.current;
    if (!viewport || !layer || !enabled) {
      return;
    }
    const update = () => {
      const keyboardBottom = viewport.offsetTop + viewport.height;
      const covered = globalThis.innerHeight - keyboardBottom;
      const current = shiftRef.current;
      // Layout geometry (offsets ignore transforms), placed from the entry,
      // which never transforms: neither the lift (maybe mid-transition) nor
      // the enter / exit animation may skew the resting frame.
      const origin = layer.parentElement?.getBoundingClientRect().top ?? 0;
      let top = origin;
      let bottom = origin + layer.offsetHeight;
      const sheet = sheetRef.current;
      if (isSheet && sheet) {
        top = origin + sheet.offsetTop;
        bottom = top + sheet.offsetHeight;
      } else {
        const extent = layoutExtent(contentRef.current);
        if (extent) {
          top = origin + extent.top;
          bottom = origin + extent.bottom;
        }
      }
      const shift = computeKeyboardShift({
        keyboardTop: covered > 1 ? keyboardBottom : undefined,
        contentTop: top,
        contentBottom: bottom,
        isSheet,
      });
      if (Math.abs(shift - current) < 0.5) {
        return;
      }
      shiftRef.current = shift;
      layer.style.transform = shift ? `translate3d(0, ${-shift}px, 0)` : '';
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      shiftRef.current = 0;
      layer.style.transform = '';
    };
  }, [contentRef, enabled, isSheet, layerRef, sheetRef]);
}
