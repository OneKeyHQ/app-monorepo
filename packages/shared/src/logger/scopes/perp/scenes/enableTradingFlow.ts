import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export type IPerpEnableTradingFlowEvent =
  | 'benchCanTradeOverride'
  | 'benchCachesReset'
  | 'termsDialogRequested'
  | 'termsNotAccepted'
  | 'requestStarted'
  | 'responseReceived'
  | 'depositRequired'
  | 'flowCompleted'
  | 'flowFailed'
  | 'autoEnableTriggered'
  | 'autoEnableResult'
  | 'blockedByMargin'
  | 'proceedDirectConfirm'
  | 'proceedConfirmDialog';

export type IPerpEnableTradingFlowTrackParams = {
  event: IPerpEnableTradingFlowEvent;
  accountId?: string;
  accountAddress?: string;
  side?: 'long' | 'short';
  canTrade?: boolean | null;
  realCanTrade?: boolean | null;
  atomCanTrade?: boolean | null;
  activatedOk?: boolean | null;
  shouldContinue?: boolean | null;
  isSoftwareAccount?: boolean | null;
  details?: Record<string, unknown>;
  errorMessage?: string;
};

export class EnableTradingFlowScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public track(params: IPerpEnableTradingFlowTrackParams) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public error(params: IPerpEnableTradingFlowTrackParams) {
    return params;
  }
}
