import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

export class WalletScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public createWallet(params: { isBiometricVerificationSet: boolean }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public deleteWallet() {}

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public importWallet(params: { importMethod: string }) {
    return params;
  }
}
