import { EFirmwareType } from '@onekeyfe/hd-shared';

import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import type { IProtocolV2FirmwareVersionDisplayItem } from '../utils';

/**
 * User-facing stages of the install page. Every SDK tip message and page
 * step collapses into one of these words.
 */
export type IFirmwareUpdateStage =
  | 'preparing'
  | 'downloading'
  | 'enteringUpdateMode'
  | 'waitingForDevice'
  | 'transferring'
  | 'installing'
  | 'verifying';

export type IFirmwareUpdateProgressType =
  | EFirmwareUpdateTipMessages
  | 'checking'
  | 'installing'
  | 'done';

const DOWNLOADING_TIPS = new Set<string>([
  EFirmwareUpdateTipMessages.StartDownloadFirmware,
  EFirmwareUpdateTipMessages.DownloadFirmware,
  EFirmwareUpdateTipMessages.DownloadFirmwareSuccess,
  EFirmwareUpdateTipMessages.DownloadLatestBootloaderResource,
  EFirmwareUpdateTipMessages.DownloadLatestBootloaderResourceSuccess,
  EFirmwareUpdateTipMessages.CheckLatestUiResource,
  EFirmwareUpdateTipMessages.DownloadLatestUiResource,
  EFirmwareUpdateTipMessages.DownloadLatestUiResourceSuccess,
  EFirmwareUpdateTipMessages.FinishDownloadFirmware,
]);

const ENTERING_UPDATE_MODE_TIPS = new Set<string>([
  EFirmwareUpdateTipMessages.AutoRebootToBootloader,
  EFirmwareUpdateTipMessages.GoToBootloaderSuccess,
  EFirmwareUpdateTipMessages.SelectDeviceInBootloaderForWebDevice,
  EFirmwareUpdateTipMessages.SwitchFirmwareReconnectDevice,
]);

const TRANSFERRING_TIPS = new Set<string>([
  EFirmwareUpdateTipMessages.StartTransferData,
]);

const INSTALLING_TIPS = new Set<string>([
  EFirmwareUpdateTipMessages.UpdateSysResource,
  EFirmwareUpdateTipMessages.UpdateSysResourceSuccess,
  EFirmwareUpdateTipMessages.FirmwareEraseSuccess,
  EFirmwareUpdateTipMessages.InstallingFirmware,
  EFirmwareUpdateTipMessages.FirmwareUpdating,
  'installing',
]);

export function getFirmwareUpdateStage({
  progressType,
  installPhase,
}: {
  progressType: IFirmwareUpdateProgressType | undefined;
  installPhase?: 'prepare' | 'install' | 'verify';
}): IFirmwareUpdateStage {
  if (!progressType || progressType === 'checking') {
    return 'preparing';
  }
  if (
    progressType === 'done' ||
    progressType === EFirmwareUpdateTipMessages.FirmwareUpdateCompleted
  ) {
    return 'verifying';
  }
  if (progressType === EFirmwareUpdateTipMessages.ConfirmOnDevice) {
    return 'waitingForDevice';
  }
  if (DOWNLOADING_TIPS.has(progressType)) {
    return 'downloading';
  }
  if (ENTERING_UPDATE_MODE_TIPS.has(progressType)) {
    return 'enteringUpdateMode';
  }
  if (TRANSFERRING_TIPS.has(progressType)) {
    return 'transferring';
  }
  if (INSTALLING_TIPS.has(progressType)) {
    return installPhase === 'verify' ? 'verifying' : 'installing';
  }
  return 'installing';
}

/** Stages during which the remaining-time estimate may be shown. */
export type IRemainingTimeBucket =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'oneMinute' }
  | { kind: 'underMinute' };

/**
 * Collapse an estimate into the three display buckets. Seconds never reach
 * the screen; the estimate itself is left untouched.
 */
export function getRemainingTimeBucket(
  estimatedRemainingMs: number,
): IRemainingTimeBucket {
  const seconds = Math.max(Math.ceil(estimatedRemainingMs / 1000), 0);
  if (seconds >= 90) {
    return { kind: 'minutes', minutes: Math.ceil(seconds / 60) };
  }
  if (seconds >= 30) {
    return { kind: 'oneMinute' };
  }
  return { kind: 'underMinute' };
}

/**
 * Multi-part updates (bootloader → firmware → Bluetooth on the legacy flow)
 * share one bar: each part owns an equal slice, so the bar never resets.
 */
export function sliceOverallProgress({
  phaseIndex,
  totalPhases,
  phaseProgress,
}: {
  phaseIndex: number;
  totalPhases: number;
  phaseProgress: number;
}) {
  if (totalPhases <= 1) {
    return phaseProgress;
  }
  const safeIndex = Math.min(Math.max(phaseIndex, 0), totalPhases - 1);
  const safePhase = Math.min(Math.max(phaseProgress, 0), 100);
  return Math.min((safeIndex * 100 + safePhase) / totalPhases, 100);
}

export type IFirmwareUpdateItem = {
  key: string;
  name: string;
  fromVersion: string | null | undefined;
  toVersion: string | null | undefined;
  /** Firmware type labels, only set when the update switches type. */
  fromTypeLabel?: string;
  toTypeLabel?: string;
  /** Rows without a version (Pro 2 resource archives). */
  noVersion?: boolean;
  /** GitHub release page for the target version, when the server has one. */
  releaseUrl?: string;
};

export function getFirmwareUpdateItems({
  result,
  protocolV2Items,
  getProtocolV2Title,
  firmwareLabel,
  bootloaderLabel,
  bluetoothLabel,
  getFirmwareTypeLabel,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  protocolV2Items: IProtocolV2FirmwareVersionDisplayItem[];
  getProtocolV2Title: (
    target: IProtocolV2FirmwareVersionDisplayItem['target'],
  ) => string;
  firmwareLabel: string;
  bootloaderLabel: string;
  bluetoothLabel: string;
  getFirmwareTypeLabel: (firmwareType: EFirmwareType | undefined) => string;
}): IFirmwareUpdateItem[] {
  if (!result?.updateInfos) {
    return [];
  }
  if (protocolV2Items.length > 0) {
    return protocolV2Items.map((item) => ({
      key: item.target,
      name: getProtocolV2Title(item.target),
      fromVersion: item.currentVersion,
      toVersion: item.targetVersion,
      noVersion: item.releaseIdentifierOnly,
    }));
  }

  const items: IFirmwareUpdateItem[] = [];
  const { firmware, bootloader, ble } = result.updateInfos;
  if (bootloader?.hasUpgrade) {
    items.push({
      key: 'bootloader',
      name: bootloaderLabel,
      fromVersion: bootloader.fromVersion,
      toVersion: bootloader.toVersion,
      releaseUrl: bootloader.githubReleaseUrl,
    });
  }
  if (firmware?.hasUpgrade) {
    const isSwitchingType =
      firmware.fromFirmwareType !== undefined &&
      firmware.toFirmwareType !== undefined &&
      firmware.fromFirmwareType !== firmware.toFirmwareType;
    items.push({
      key: 'firmware',
      name: firmwareLabel,
      fromVersion: firmware.fromVersion,
      toVersion: firmware.toVersion,
      releaseUrl: firmware.githubReleaseUrl,
      ...(isSwitchingType
        ? {
            fromTypeLabel: getFirmwareTypeLabel(
              firmware.fromFirmwareType ?? EFirmwareType.Universal,
            ),
            toTypeLabel: getFirmwareTypeLabel(
              firmware.toFirmwareType ?? EFirmwareType.Universal,
            ),
          }
        : {}),
    });
  }
  if (ble?.hasUpgrade) {
    items.push({
      key: 'ble',
      name: bluetoothLabel,
      fromVersion: ble.fromVersion,
      toVersion: ble.toVersion,
      releaseUrl: ble.githubReleaseUrl,
    });
  }
  return items;
}

/**
 * The line under the title. A single part shows plain text; several parts
 * show the primary part and let the caller render it as the details pill.
 */
export function getPrimaryFirmwareUpdateItem(
  items: IFirmwareUpdateItem[],
): IFirmwareUpdateItem | undefined {
  return (
    items.find((item) => item.key === 'firmware' || item.key === 'safeos') ??
    items[0]
  );
}

export function formatFirmwareUpdateVersionRange({
  item,
  isVersionValid,
}: {
  item: IFirmwareUpdateItem;
  isVersionValid: (version: string) => boolean;
}): { from: string | undefined; to: string } {
  const withType = (label: string | undefined, version: string) =>
    label ? `${label} ${version}` : version;
  const to =
    item.toVersion && isVersionValid(item.toVersion)
      ? withType(item.toTypeLabel, item.toVersion)
      : '';
  const from =
    item.fromVersion && isVersionValid(item.fromVersion)
      ? withType(item.fromTypeLabel, item.fromVersion)
      : undefined;
  return { from, to };
}
