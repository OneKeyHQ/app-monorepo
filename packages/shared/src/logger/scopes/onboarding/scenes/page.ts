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

  // The user pressed "Connect" on a scanned device (funnel step between
  // entering the connect page and walletAdded).
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public connectFoundDevice(deviceType: string, channel: string) {
    return {
      deviceType,
      channel,
    };
  }
}
