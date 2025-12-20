import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public pickYourDevice(deviceType: string) {
    return {
      deviceType,
    };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public connectYourDevice(deviceType: string, tabValue: string) {
    return {
      deviceType,
      channel: tabValue,
    };
  }
}
