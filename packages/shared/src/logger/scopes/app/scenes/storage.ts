import type {
  IStorageFullDiagnostics,
  IStorageQuotaInfo,
} from '@onekeyhq/shared/src/storageChecker/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export type ISimpleDbUnreadableSelfHealPhase =
  | 'detected'
  | 'retry'
  | 'recovered'
  | 'deleted'
  | 'deleteSkipped';

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

  // IndexedDB external-blob unreadable-record self-heal trail (exportable via
  // local logs). Always includes errorName/errorMessage so exports show which
  // SimpleDB key hit "Failed to read large IndexedDB value". No record body.
  @LogToLocal({ level: 'warn' })
  public simpleDbUnreadableSelfHeal(params: {
    entityName: string;
    entityKey: string;
    phase: ISimpleDbUnreadableSelfHealPhase;
    errorName: string;
    errorMessage: string;
    attempt?: number;
    delayMs?: number;
    reason?: string;
  }) {
    return params;
  }
}
