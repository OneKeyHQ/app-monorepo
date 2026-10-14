import { EDeviceType } from '@onekeyfe/hd-shared';

import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

const numericLogFields = new Set([
  'progress',
  'installTargetId',
  'installPhaseProgress',
  'transferredBytes',
  'totalBytes',
  'rateBytesPerSecond',
  'elapsedMs',
  'firmwareProgress',
  'firmwareInstallTargetId',
  'firmwareInstallPhaseProgress',
]);
const booleanLogFields = new Set([
  'isBootloaderMode',
  'deviceOnly',
  'existsAttachPinUser',
]);
const enumLogFields: Record<string, readonly string[]> = {
  uiRequestType: Object.values(EHardwareUiStateAction),
  eventType: [...Object.values(EHardwareUiStateAction), 'request-passphrase'],
  deviceType: Object.values(EDeviceType),
  deviceMode: Object.values(EOneKeyDeviceMode),
  progressType: ['transferData', 'installingFirmware'],
  firmwareProgressType: ['transferData', 'installingFirmware'],
  installPhase: ['prepare', 'install', 'verify'],
  firmwareInstallPhase: ['prepare', 'install', 'verify'],
  source: ['wallet-session-coordinator'],
  reason: ['session-recovery', 'open-wallet', 'change-pin', 'firmware-update'],
};

function compactLogPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (numericLogFields.has(key)) {
        return typeof value === 'number' && Number.isFinite(value);
      }
      if (booleanLogFields.has(key)) {
        return typeof value === 'boolean';
      }
      if (key === 'firmwareTransferMetrics') {
        return value !== undefined;
      }
      return typeof value === 'string' && enumLogFields[key]?.includes(value);
    }),
  );
}

export function buildHardwareUiEventLogPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const event = payload as Record<string, unknown>;
  const device =
    event.device && typeof event.device === 'object'
      ? (event.device as Record<string, unknown>)
      : undefined;
  return compactLogPayload({
    eventType: event.type,
    deviceType: device?.deviceType,
    progress: event.progress,
    progressType: event.progressType,
    installTargetId: event.installTargetId,
    installPhase: event.installPhase,
    installPhaseProgress: event.installPhaseProgress,
    transferredBytes: event.transferredBytes,
    totalBytes: event.totalBytes,
    rateBytesPerSecond: event.rateBytesPerSecond,
    elapsedMs: event.elapsedMs,
    source: event.source,
    reason: event.reason,
    deviceOnly: event.deviceOnly,
    existsAttachPinUser: event.existsAttachPinUser,
  });
}

export function buildHardwareUiStateLogPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const state = payload as Record<string, unknown>;
  const transferMetrics =
    state.firmwareTransferMetrics &&
    typeof state.firmwareTransferMetrics === 'object'
      ? (state.firmwareTransferMetrics as Record<string, unknown>)
      : undefined;
  return compactLogPayload({
    uiRequestType: state.uiRequestType,
    eventType: state.eventType,
    deviceType: state.deviceType,
    deviceMode: state.deviceMode,
    isBootloaderMode: state.isBootloaderMode,
    firmwareProgress: state.firmwareProgress,
    firmwareProgressType: state.firmwareProgressType,
    firmwareInstallTargetId: state.firmwareInstallTargetId,
    firmwareInstallPhase: state.firmwareInstallPhase,
    firmwareInstallPhaseProgress: state.firmwareInstallPhaseProgress,
    firmwareTransferMetrics: transferMetrics
      ? compactLogPayload({
          transferredBytes: transferMetrics.transferredBytes,
          totalBytes: transferMetrics.totalBytes,
          rateBytesPerSecond: transferMetrics.rateBytesPerSecond,
          elapsedMs: transferMetrics.elapsedMs,
        })
      : undefined,
    source: state.source,
    reason: state.reason,
    deviceOnly: state.deviceOnly,
    existsAttachPinUser: state.existsAttachPinUser,
  });
}

export class HardwareSDKScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(eventName: string, version: number | string = '') {
    return `${eventName} ${version}`;
  }

  /** Third-party hardware (Ledger, ...) searchDevices result. The `thirdParty`
   *  prefix distinguishes these logs from the OneKey HD-SDK path. */
  @LogToLocal({ level: 'info' })
  public thirdPartySearchDevicesResponse(params: {
    vendor: EHardwareVendor;
    success: boolean;
    count: number;
  }) {
    return params;
  }

  @LogToConsole()
  public uiEvent(type: string, payload: any) {
    const logPayload = buildHardwareUiEventLogPayload(payload);
    return [
      type,
      type === 'ui-firmware-progress' ? logPayload : devOnlyData(logPayload),
    ];
  }

  @LogToLocal()
  public connectError(params: {
    connectId: string;
    deviceId: string;
    deviceType: IDeviceType;
    uuid: string;
    error: string;
  }) {
    return {
      connectId: params.connectId,
      deviceId: params.deviceId,
      deviceType: params.deviceType,
      uuid: params.uuid,
      error: params.error,
    };
  }

  @LogToLocal()
  public updateHardwareUiStateAtom({
    action,
    connectId,
    payload,
  }: {
    action: string;
    connectId: string;
    payload: any;
  }) {
    const logPayload = buildHardwareUiStateLogPayload(payload);
    return [
      action,
      connectId,
      action === 'ui-firmware-progress' ? logPayload : devOnlyData(logPayload),
    ];
  }

  /**
   * App-side hardware event evidence (device state receipt/persistence,
   * settings read-backs, UI event application). Structured payloads, low
   * frequency (hardware operations only).
   */
  @LogToLocal({ level: 'info' })
  public serviceEvent(name: string, payload?: unknown) {
    return [name, payload];
  }
}
