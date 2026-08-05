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
  const remainingDelay = Math.max(0, delayMs - (now() - finishTime));
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
