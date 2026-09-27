import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const DRAG_START_THRESHOLD = 6;
const DISMISS_DISTANCE_RATIO = 0.4;
const DISMISS_VELOCITY = 0.5; // px per ms
const UPWARD_RESISTANCE = 0.2;
const SETTLE_TRANSITION = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)';

function scrolledAncestorWithin(
  target: EventTarget | null,
  sheet: HTMLElement,
) {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== sheet) {
    if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return undefined;
}

/**
 * Pointer-driven drag-to-dismiss for the web bottom sheet: follows the
 * finger downward, resists upward, and dismisses past 40% of the height or
 * on a fast flick. A drag never starts from inside scrolled content.
 */
export function useSheetDrag({
  sheetRef,
  backdropRef,
  enabled,
  onDismissByPan,
}: {
  sheetRef: RefObject<HTMLDivElement | null>;
  backdropRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onDismissByPan: () => void;
}) {
  const onDismissRef = useRef(onDismissByPan);
  onDismissRef.current = onDismissByPan;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !enabled) {
      return;
    }
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let tracking = false;
    let dragging = false;
    let pointerId = -1;

    const setOffset = (offset: number) => {
      sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
      const backdrop = backdropRef.current;
      if (backdrop && offset > 0) {
        backdrop.style.opacity = String(
          Math.max(0, 1 - offset / sheet.offsetHeight),
        );
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || scrolledAncestorWithin(event.target, sheet)) {
        return;
      }
      tracking = true;
      dragging = false;
      pointerId = event.pointerId;
      startY = event.clientY;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      velocity = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId) {
        return;
      }
      const dy = event.clientY - startY;
      if (!dragging) {
        if (dy < DRAG_START_THRESHOLD) {
          return;
        }
        dragging = true;
        sheet.setPointerCapture(pointerId);
        sheet.style.transition = 'none';
      }
      const dt = Math.max(1, event.timeStamp - lastTime);
      velocity = (event.clientY - lastY) / dt;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      setOffset(dy > 0 ? dy : dy * UPWARD_RESISTANCE);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!tracking || event.pointerId !== pointerId) {
        return;
      }
      tracking = false;
      if (!dragging) {
        return;
      }
      dragging = false;
      const dy = event.clientY - startY;
      const height = sheet.offsetHeight;
      sheet.style.transition = SETTLE_TRANSITION;
      if (dy > height * DISMISS_DISTANCE_RATIO || velocity > DISMISS_VELOCITY) {
        setOffset(height);
        onDismissRef.current();
      } else {
        setOffset(0);
        if (backdropRef.current) {
          backdropRef.current.style.opacity = '1';
        }
      }
      // Swallow the click that follows a drag so buttons under the finger
      // do not fire.
      sheet.addEventListener(
        'click',
        (clickEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
        },
        { capture: true, once: true },
      );
    };

    sheet.addEventListener('pointerdown', onPointerDown);
    sheet.addEventListener('pointermove', onPointerMove);
    sheet.addEventListener('pointerup', onPointerUp);
    sheet.addEventListener('pointercancel', onPointerUp);
    return () => {
      sheet.removeEventListener('pointerdown', onPointerDown);
      sheet.removeEventListener('pointermove', onPointerMove);
      sheet.removeEventListener('pointerup', onPointerUp);
      sheet.removeEventListener('pointercancel', onPointerUp);
    };
  }, [sheetRef, backdropRef, enabled]);
}
