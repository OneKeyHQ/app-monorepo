import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IQrScanAvailabilityContext = {
  attemptId: string;
  input: 'camera' | 'library';
  scene: 'general' | 'qr_wallet';
};

export class ReadQrCodeScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public cameraPermissionResult(params: {
    durationMs: number;
    errorCode: string;
    status: 'denied' | 'error' | 'existing_grant' | 'request_grant';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public qrScanAttempt(params: IQrScanAvailabilityContext) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public qrScanResult(
    params: IQrScanAvailabilityContext & {
      durationMs: number;
      errorCode: string;
      status: 'cancelled' | 'failed' | 'no_code' | 'success';
    },
  ) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public releaseCamera() {}

  @LogToLocal({ level: 'info' })
  public readFromCamera(value: string) {
    return devOnlyData(value);
  }

  @LogToLocal({ level: 'info' })
  public readFromLibrary(imageResult: string, stringResult: string | null) {
    return devOnlyData({ imageResult, stringResult });
  }
}
