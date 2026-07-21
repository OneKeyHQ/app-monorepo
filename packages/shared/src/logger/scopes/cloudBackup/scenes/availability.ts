import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type ICloudBackupAvailabilityContext = {
  attemptId: string;
  operation: 'backup' | 'restore';
  provider: 'google_drive' | 'icloud' | 'unsupported';
};

export class CloudBackupAvailabilityScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  operationAttempt(params: ICloudBackupAvailabilityContext) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  operationResult(
    params: ICloudBackupAvailabilityContext & {
      durationMs: number;
      errorCode: string;
      status: 'cancelled' | 'failed' | 'partial' | 'success' | 'timeout';
    },
  ) {
    return params;
  }
}
