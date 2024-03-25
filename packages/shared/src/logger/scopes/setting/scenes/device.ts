import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';
import { getDeviceInfo } from '../../../utils';

export class DeviceScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public logDeviceInfo() {
    return getDeviceInfo();
  }
}
