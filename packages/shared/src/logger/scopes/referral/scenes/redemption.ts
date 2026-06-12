import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IRedemptionCenterSource = 'more_action' | 'deeplink' | 'unknown';

export type IBtcRewardCodeVerifyResult = 'success' | 'not_found' | 'failed';

export type IBtcRewardActionResult = 'success' | 'failed';

export class RedemptionScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public showSuccessDialog() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public successDialogDoneClick() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public successDialogViewChangesClick() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public startRedeem(code: string) {
    return { code };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public redeemFailed(code: string, reason: string) {
    return { code, reason };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public redeemSuccess(code: string) {
    return { code };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public redeemError(code: string, error: string) {
    return { code, error };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public loadHistory() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public redemptionCenterOpen(params: {
    source: IRedemptionCenterSource;
    hasInitialCode: boolean;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public btcRewardCodeVerifyResult(params: {
    result: IBtcRewardCodeVerifyResult;
    source: IRedemptionCenterSource;
    hasInitialCode: boolean;
    errorCode?: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public btcRewardOrderClaimVerifyResult(params: {
    result: IBtcRewardActionResult;
    errorCode?: number;
    quotaRemaining?: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public btcRewardCommitResult(params: {
    result: IBtcRewardActionResult;
    errorCode?: number;
    rewardUsd: number;
  }) {
    return params;
  }
}
