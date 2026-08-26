import type { IFirmwareTransferMetrics } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

const ETA_WARMUP_ELAPSED_MS = 2000;
const ETA_WARMUP_TRANSFERRED_BYTES = 64 * 1024;

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${Math.round(bytes)} B`;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function getFirmwareTransferDisplayMetrics(
  metrics: IFirmwareTransferMetrics | undefined,
) {
  const transferredBytes = metrics?.transferredBytes;
  const totalBytes = metrics?.totalBytes;
  const rateBytesPerSecond = metrics?.rateBytesPerSecond;
  const elapsedMs = metrics?.elapsedMs;
  if (
    !Number.isFinite(transferredBytes) ||
    !Number.isFinite(totalBytes) ||
    !Number.isFinite(rateBytesPerSecond) ||
    !Number.isFinite(elapsedMs) ||
    (transferredBytes ?? -1) < 0 ||
    (totalBytes ?? 0) <= 0 ||
    (rateBytesPerSecond ?? 0) <= 0 ||
    (elapsedMs ?? -1) < 0
  ) {
    return undefined;
  }

  const confirmedTransferredBytes = transferredBytes as number;
  const confirmedTotalBytes = totalBytes as number;
  const confirmedRateBytesPerSecond = rateBytesPerSecond as number;
  const confirmedElapsedMs = elapsedMs as number;
  const remainingBytes = Math.max(
    confirmedTotalBytes - confirmedTransferredBytes,
    0,
  );
  const estimatedRemainingMs =
    confirmedElapsedMs >= ETA_WARMUP_ELAPSED_MS &&
    confirmedTransferredBytes >= ETA_WARMUP_TRANSFERRED_BYTES &&
    remainingBytes > 0
      ? Math.ceil((remainingBytes / confirmedRateBytesPerSecond) * 1000)
      : undefined;

  return {
    transferredText: formatBytes(confirmedTransferredBytes),
    totalText: formatBytes(confirmedTotalBytes),
    speedText: `${formatBytes(confirmedRateBytesPerSecond)}/s`,
    elapsedText: formatDuration(confirmedElapsedMs),
    estimatedRemainingText:
      estimatedRemainingMs === undefined
        ? undefined
        : formatDuration(estimatedRemainingMs),
  };
}

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
