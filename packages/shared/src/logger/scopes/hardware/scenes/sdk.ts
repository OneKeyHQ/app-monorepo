import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

export class HardwareSDKScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(eventName: string, version: number | string = '') {
    return `${eventName} ${version}`;
  }

  @LogToConsole()
  public uiEvent(type: string, payload: any) {
    return [type, devOnlyData(payload)];
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
    // filter rawPayload properties
    const newPayload = {
      ...payload,
      rawPayload: undefined,
    };
    return [action, connectId, devOnlyData(newPayload)];
  }
}
