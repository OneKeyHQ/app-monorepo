import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

const ESTIMATED_PROGRESS_STEP_RATIO = 0.03;

export const PRO2_INSTALL_ESTIMATED_PROGRESS_MAX = 89;
export const PRO2_RECONNECT_ESTIMATED_PROGRESS_MAX = 98;

export function normalizeFirmwareUpdateProgressType<T extends string>(type: T) {
  return type === EFirmwareUpdateTipMessages.GoToBootloaderSuccess
    ? EFirmwareUpdateTipMessages.AutoRebootToBootloader
    : type;
}

export function calculateProgressInRange({
  startAt,
  maxAt,
  currentProgress,
}: {
  startAt: number;
  maxAt: number;
  currentProgress: number | null | undefined;
}) {
  const progress = startAt + (currentProgress ?? 0) * ((maxAt - startAt) / 100);
  return Math.min(progress, maxAt);
}

export function getNextEstimatedFirmwareProgress({
  currentProgress,
  maxProgress,
}: {
  currentProgress: number;
  maxProgress: number;
}) {
  if (currentProgress >= maxProgress) {
    return currentProgress;
  }

  return (
    currentProgress +
    (maxProgress - currentProgress) * ESTIMATED_PROGRESS_STEP_RATIO
  );
}
