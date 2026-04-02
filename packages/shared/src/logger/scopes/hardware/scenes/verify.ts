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
}
