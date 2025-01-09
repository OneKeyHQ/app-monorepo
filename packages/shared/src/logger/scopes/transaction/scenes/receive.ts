import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class ReceiveScene extends BaseScene {
  @LogToServer()
  public showReceived({
    walletType,
    isSuccess,
    failedReason,
  }: {
    walletType: string | undefined;
    isSuccess: boolean;
    failedReason: string | undefined;
  }) {
    return {
      walletType,
      isSuccess,
      failedReason,
    };
  }
}
