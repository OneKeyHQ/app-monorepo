export interface IPointerPoint {
  x: number;
  y: number;
}

/**
 * Guards tab close buttons right after the column expands. The guard arms only
 * when the pointer moves at least `thresholdPx` away from where it rested once
 * `delayMs` has elapsed, so a click aimed at a favicon in the collapsed column
 * does not land on a close button that just appeared.
 *
 * The origin is fixed at the latest known pointer position when the delay
 * expires, so the very first move after expiry is already measured against the
 * threshold. Moves before expiry never count.
 */
export function createCloseArmGuard({
  delayMs,
  thresholdPx,
  getLatestPointer,
  onArm,
}: {
  delayMs: number;
  thresholdPx: number;
  getLatestPointer: () => IPointerPoint | null;
  onArm: () => void;
}) {
  let origin: IPointerPoint | null = null;
  let isSettled = false;
  let isArmed = false;

  const settleTimer = setTimeout(() => {
    isSettled = true;
    origin = getLatestPointer();
  }, delayMs);

  return {
    onPointerMove(point: IPointerPoint) {
      if (!isSettled || isArmed) return;
      if (!origin) {
        // No position was known at expiry, so this move can only set the origin.
        origin = point;
        return;
      }
      if (
        Math.abs(point.x - origin.x) >= thresholdPx ||
        Math.abs(point.y - origin.y) >= thresholdPx
      ) {
        isArmed = true;
        onArm();
      }
    },
    dispose() {
      clearTimeout(settleTimer);
    },
  };
}
