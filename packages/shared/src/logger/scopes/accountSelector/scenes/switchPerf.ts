import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class AccountSelectorSwitchPerfScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public lifecycle(params: {
    stage:
      | 'openRequested'
      | 'modalMounted'
      | 'selectionStarted'
      | 'selectionCommitted'
      | 'dismissRequested'
      | 'modalUnmounted';
    num: number;
    walletName?: string;
    accountName?: string;
    elapsedMs?: number;
    sameAccount?: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public functionTiming(params: {
    functionName: string;
    durationMs: number;
    num: number;
    walletName?: string;
    accountName?: string;
    phase?: string;
    outcome?: string;
    inputCount?: number;
    outputCount?: number;
    baseDurationMs?: number;
    startTimeMs?: number;
    commitTimeMs?: number;
  }) {
    return params;
  }
}
