import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

function compactLogPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
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
  return compactLogPayload({
    uiRequestType: state.uiRequestType,
    eventType: state.eventType,
    deviceType: state.deviceType,
    deviceMode: state.deviceMode,
    isBootloaderMode: state.isBootloaderMode,
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
    return [type, devOnlyData(buildHardwareUiEventLogPayload(payload))];
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
    return [
      action,
      connectId,
      devOnlyData(buildHardwareUiStateLogPayload(payload)),
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
