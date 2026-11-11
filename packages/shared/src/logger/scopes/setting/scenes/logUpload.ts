import { BaseScene } from '@onekeyhq/shared/src/logger/base/baseScene';
import { LogToLocal } from '@onekeyhq/shared/src/logger/base/decorators';
import type {
  ILogUploadAttemptLog,
  ILogUploadFlowLog,
  ILogUploadResultLog,
} from '@onekeyhq/shared/src/logger/types';

// Never log upload tokens or file contents here.
export class LogUploadScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public uploadStart(params: ILogUploadAttemptLog) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public uploadSucceeded(params: ILogUploadResultLog) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public uploadFailed(params: ILogUploadResultLog) {
    return params;
  }

  @LogToLocal({ level: 'warn' })
  public attemptFailed(params: ILogUploadFlowLog) {
    return params;
  }
}
