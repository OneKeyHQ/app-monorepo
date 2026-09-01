import type { INativeSyncStorageName } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';
import { NO_LOG_OUTPUT } from '../../../types';

export class BackgroundScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public call(serviceAndMethodName: string) {
    if (['serviceSetting.refreshLastActivity'].includes(serviceAndMethodName)) {
      return NO_LOG_OUTPUT;
    }
    return serviceAndMethodName;
  }

  /** Tracks one bounded state transition for a native storage queue outage. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public nativeStorageQueueState(params: {
    errorType: string;
    eventType: 'degraded' | 'recovered' | 'stalled';
    failedAttemptCount: number;
    maxOldestRequestAgeMs: number;
    maxQueueSize: number;
    pendingQueueSize: number;
    stallDurationMs: number;
    stallThresholdMs?: number;
    store: INativeSyncStorageName;
  }) {
    return params;
  }
}
