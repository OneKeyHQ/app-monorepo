import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

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
}
