import { useCallback, useEffect, useRef, useState } from 'react';

import { createCloseArmGuard } from './closeArmGuard';

import type { IPointerPoint } from './closeArmGuard';

/**
 * Wires pointer events of the browser submenu column to the close-button arm
 * guard. The latest pointer position is recorded on enter (the column can
 * appear under a stationary cursor, which fires mouseenter but no move) and on
 * every move, and is cleared on leave and on collapse, so a position left from
 * an earlier expand can never become the guard's movement origin.
 */
export function useBrowserSubmenuCloseArm({
  isExpanded,
  delayMs,
  thresholdPx,
}: {
  isExpanded: boolean;
  delayMs: number;
  thresholdPx: number;
}) {
  const [isCloseArmed, setIsCloseArmed] = useState(false);
  const lastPointerRef = useRef<IPointerPoint | null>(null);
  const guardRef = useRef<ReturnType<typeof createCloseArmGuard> | null>(null);

  const onPointerEnter = useCallback((point: IPointerPoint) => {
    lastPointerRef.current = point;
  }, []);

  const onPointerMove = useCallback((point: IPointerPoint) => {
    lastPointerRef.current = point;
    guardRef.current?.onPointerMove(point);
  }, []);

  const onPointerLeave = useCallback(() => {
    lastPointerRef.current = null;
  }, []);

  // Call in the same batch as expanding so rows never show a close button in
  // the first expanded frame.
  const disarm = useCallback(() => {
    setIsCloseArmed(false);
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    const guard = createCloseArmGuard({
      delayMs,
      thresholdPx,
      getLatestPointer: () => lastPointerRef.current,
      onArm: () => setIsCloseArmed(true),
    });
    guardRef.current = guard;
    return () => {
      guard.dispose();
      guardRef.current = null;
      lastPointerRef.current = null;
    };
  }, [isExpanded, delayMs, thresholdPx]);

  return {
    isCloseArmed,
    lastPointerRef,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
    disarm,
  };
}
