import type { IAllDeviceVerifyVersions } from '@onekeyhq/shared/types/device';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class HardwareVerifyScene extends BaseScene {
  @LogToLocal()
  public verifyFailed(params: {
    local: IAllDeviceVerifyVersions;
    server: IAllDeviceVerifyVersions;
  }) {
    return {
      localFirmware: params.local.firmware.raw,
      localBluetooth: params.local.bluetooth.raw,
      localBootloader: params.local.bootloader.raw,
      serverFirmware: params.server.firmware.raw,
      serverBluetooth: params.server.bluetooth.raw,
      serverBootloader: params.server.bootloader.raw,
    };
  }

  // Tripwire: fires only when verifiedAtVersion degrades from version → empty.
  @LogToLocal()
  public deviceVerifiedAtVersionCleared(params: {
    deviceId: string;
    oldValue: string;
    newValueRaw: string;
    stack?: string;
  }) {
    return params;
  }

  // Compares UI value vs fresh localDb re-read AND a re-issued service
  // call to disambiguate DB-truth, service-layer bug, usePromiseResult
  // cache staleness, and wallet→device association bugs.
  @LogToLocal()
  public deviceUnverifiedDetected(params: {
    dbDeviceId: string;
    deviceId: string;
    uiWalletId: string;
    uiVerifiedAtVersion: string;
    freshDbFound?: boolean;
    freshDbVerifiedAtVersion?: string;
    requeryServiceFound?: boolean;
    requeryServiceMatchCount?: number;
    requeryServiceWalletId?: string;
    requeryServiceVerifiedAtVersion?: string;
    mismatch: boolean;
    createdAt: number;
    updatedAt: number;
    connectId?: string;
  }) {
    return params;
  }
}
