import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class FirmwareScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public updateFirmware(params: {
    updateType: 'firmware' | 'bootloader';
    connectType: 'usb' | 'ble';
    deviceType: string;
    firmwareVersion: string;
    targetVersion: string;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
  }) {
    return params;
  }
}
