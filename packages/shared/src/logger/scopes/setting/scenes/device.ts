import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';
import utils from '../../../utils';

export class DeviceScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public logDeviceInfo() {
    return utils.getDeviceInfo();
  }
}
