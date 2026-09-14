export type IFirmwareRecheckTimer = () => void;

export function createFirmwareRecheckTimer({
  finishTime,
  delayMs,
  now = Date.now,
  onFire,
}: {
  finishTime: number;
  delayMs: number;
  now?: () => number;
  onFire: () => void;
}): IFirmwareRecheckTimer {
  let active = true;
  const boundedDelayMs = Math.max(0, delayMs);
  const remainingDelay = Math.min(
    boundedDelayMs,
    Math.max(0, boundedDelayMs - (now() - finishTime)),
  );
  const timeoutId = setTimeout(() => {
    if (!active) {
      return;
    }
    active = false;
    onFire();
  }, remainingDelay);

  return () => {
    if (!active) {
      return;
    }
    active = false;
    clearTimeout(timeoutId);
  };
}
