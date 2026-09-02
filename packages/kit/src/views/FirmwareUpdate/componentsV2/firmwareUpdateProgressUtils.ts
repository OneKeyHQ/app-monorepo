import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

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
