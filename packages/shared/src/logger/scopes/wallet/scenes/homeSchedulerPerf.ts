import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class HomeSchedulerPerfScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public snapshot(params: {
    stage: 'requestQueue' | 'sessionCancellation';
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
  }) {
    return params;
  }
}
