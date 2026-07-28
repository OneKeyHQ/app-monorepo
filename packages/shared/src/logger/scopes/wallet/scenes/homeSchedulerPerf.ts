import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class HomeSchedulerPerfScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public snapshot(params: {
    stage:
      | 'requestQueue'
      | 'sessionCancellation'
      | 'sourceBatchOutcome'
      | 'sourceOutcome';
    walletName?: string;
    accountName?: string;
    pendingCount?: number;
    runningCount?: number;
    peakPendingCount?: number;
    peakRunningCount?: number;
    schedulerPendingBefore?: number;
    schedulerRunningBefore?: number;
    leafPendingBefore?: number;
    leafGlobalRunningBefore?: number;
    activeSourceCount?: number;
    inFlightSourceCount?: number;
    sourceId?: string;
    requestSequence?: number;
    schedulerOutcome?: string;
    durationMs?: number;
    mode?: 'lp' | 'wallet';
    expectedTargetCount?: number;
    attemptCount?: number;
    fulfilledCount?: number;
    rejectedCount?: number;
    staleAuthorityCount?: number;
    finalRowCount?: number;
    resultClassification?: 'success' | 'error';
  }) {
    return params;
  }
}
