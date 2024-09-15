import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class WalletScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public onboard(params: {
    onboardMethod:
      | 'createWallet'
      | 'importWallet'
      | 'connectHWWallet'
      | 'connect3rdPartyWallet';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public createWallet(params: { isBiometricVerificationSet: boolean }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public deleteWallet() {}

  @LogToServer()
  @LogToLocal()
  public importWallet(params: { importMethod: string }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public connectHWWallet(params: {
    connectType: string;
    deviceType: string;
    deviceFmVersion?: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public connect3rdPartyWallet(params: {
    ['3rdpartyConnectNetwork']: string;
    ['3rdpartyConnectType']: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public backupWallet(backupMethod: string) {
    return {
      backupMethod,
    };
  }
}
