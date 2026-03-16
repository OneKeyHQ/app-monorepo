import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

export class HardwareConnectionScene extends BaseScene {
  @LogToServer()
  public hwDeviceConnected(params: {
    deviceType: IDeviceType;
    firmwareType: 'btconly' | 'universal';
    deviceId: string;
  }) {
    return params;
  }
}
