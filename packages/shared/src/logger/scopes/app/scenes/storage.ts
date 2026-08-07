import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

import type {
  IStorageFullDiagnostics,
  IStorageQuotaInfo,
} from '../../../../storageChecker/types';

export class StorageScene extends BaseScene {
  @LogToLocal()
  public quotaMeasured(quotaInfo: IStorageQuotaInfo) {
    return quotaInfo;
  }

  @LogToLocal()
  public diskFullDetected(diagnostics: IStorageFullDiagnostics) {
    return diagnostics;
  }

  @LogToLocal()
  public diskFullCleared(quotaInfo: IStorageQuotaInfo) {
    return quotaInfo;
  }

  @LogToLocal()
  public connectionInvalidated(params: { dbName: string; trigger: string }) {
    return params;
  }
}
