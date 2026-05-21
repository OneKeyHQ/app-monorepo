import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IPerpEnableTradingStepResult = 'success' | 'failure';

export type IPerpEnableTradingStepName =
  | 'enableTrading.total'
  | 'checkStatus.userRole'
  | 'checkStatus.builderFee'
  | 'checkStatus.rebateBinding'
  | 'checkStatus.extraAgents'
  | 'checkStatus.approveBuilderFee'
  | 'checkStatus.approveAgent'
  | 'checkStatus.agentSlotRecovery'
  | 'checkStatus.fetchUserAbstraction'
  | 'checkStatus.setAbstraction'
  | 'checkStatus.persistStatus';

export type IPerpEnableTradingTimingTrackStepParams = {
  step: IPerpEnableTradingStepName;
  durationMs: number;
  stepResult: IPerpEnableTradingStepResult;
  isEnableTradingTrigger?: boolean;
};

export class EnableTradingTimingScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public trackStep(params: IPerpEnableTradingTimingTrackStepParams) {
    return params;
  }
}
