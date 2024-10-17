import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

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
  public updateHardwareUiStateAtom({
    action,
    connectId,
    payload,
  }: {
    action: string;
    connectId: string;
    payload: any;
  }) {
    return [action, connectId, devOnlyData(payload)];
  }
}
