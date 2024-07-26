import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../decorators';

export class ReceiveScene extends BaseScene {
  @LogToServer()
  public logShowReceiveAddressInfo({
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
