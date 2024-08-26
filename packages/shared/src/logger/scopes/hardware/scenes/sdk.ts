import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class HardwareSDKScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(eventName: string, version: number | string = '') {
    return `${eventName} ${version}`;
  }
}
