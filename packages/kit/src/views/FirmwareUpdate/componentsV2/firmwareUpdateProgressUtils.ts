import type { IFirmwareTransferMetrics } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import type { IntlShape } from 'react-intl';

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

function formatDuration(
  durationMs: number,
  intl: Pick<IntlShape, 'formatNumber'>,
) {
  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secondsText = intl.formatNumber(seconds, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'short',
  });
  if (minutes === 0) {
    return secondsText;
  }
  const minutesText = intl.formatNumber(minutes, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'short',
  });
  return `${minutesText} ${secondsText}`;
}

function hasFirmwareTransferMetrics(
  metrics: IFirmwareTransferMetrics | undefined,
): metrics is Required<IFirmwareTransferMetrics> {
  const { transferredBytes, totalBytes, rateBytesPerSecond, elapsedMs } =
    metrics ?? {};
  return (
    Number.isFinite(transferredBytes) &&
    Number.isFinite(totalBytes) &&
    Number.isFinite(rateBytesPerSecond) &&
    Number.isFinite(elapsedMs) &&
    (transferredBytes ?? -1) >= 0 &&
    (totalBytes ?? 0) > 0 &&
    (rateBytesPerSecond ?? 0) > 0 &&
    (elapsedMs ?? -1) >= 0
  );
}

/**
 * Milliseconds left in the transfer, or undefined until the rate has warmed
 * up (enough time and bytes) or once nothing remains. Pure arithmetic for
 * the install page, which renders minute buckets only.
 */
export function getFirmwareTransferEtaMs(
  metrics: IFirmwareTransferMetrics | undefined,
): number | undefined {
  if (!hasFirmwareTransferMetrics(metrics)) {
    return undefined;
  }
  const remainingBytes = Math.max(
    metrics.totalBytes - metrics.transferredBytes,
    0,
  );
  return metrics.elapsedMs >= ETA_WARMUP_ELAPSED_MS &&
    metrics.transferredBytes >= ETA_WARMUP_TRANSFERRED_BYTES &&
    remainingBytes > 0
    ? Math.ceil((remainingBytes / metrics.rateBytesPerSecond) * 1000)
    : undefined;
}

export function getFirmwareTransferDisplayMetrics(
  metrics: IFirmwareTransferMetrics | undefined,
  intl: Pick<IntlShape, 'formatNumber'>,
) {
  if (!hasFirmwareTransferMetrics(metrics)) {
    return undefined;
  }
  const estimatedRemainingMs = getFirmwareTransferEtaMs(metrics);
  return {
    transferredText: formatBytes(metrics.transferredBytes),
    totalText: formatBytes(metrics.totalBytes),
    speedText: `${formatBytes(metrics.rateBytesPerSecond)}/s`,
    elapsedText: formatDuration(metrics.elapsedMs, intl),
    estimatedRemainingMs,
    estimatedRemainingText:
      estimatedRemainingMs === undefined
        ? undefined
        : formatDuration(estimatedRemainingMs, intl),
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

export function resolveFirmwareInstallProgress({
  firmwareProgress,
}: {
  installPhaseProgress: number | undefined;
  firmwareProgress: number | undefined;
}) {
  // Phase progress resets for prepare, install, and verify, so it cannot drive
  // the aggregate installation progress bar.
  return firmwareProgress;
}
