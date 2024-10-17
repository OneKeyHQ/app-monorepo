import type { IServerNetwork } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

interface IToken {
  network: string;
  tokenSymbol: string;
  tokenAddress: string;
}

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

  @LogToServer()
  @LogToLocal()
  public enterManageToken() {}

  @LogToServer()
  @LogToLocal()
  public addCustomToken(token: IToken) {
    return token;
  }

  @LogToServer()
  @LogToLocal()
  public removeCustomToken(token: IToken) {
    return token;
  }

  @LogToServer()
  @LogToLocal()
  public walletManualRefresh() {}

  @LogToServer()
  @LogToLocal()
  public copyAddress(params: { walletType: 'hdWallet' | 'hwWallet' }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public openSidePanel() {}

  @LogToServer()
  @LogToLocal()
  public openExpandView() {}

  @LogToServer()
  @LogToLocal()
  public customNetworkAdded(params: { chainID: string }) {
    return params;
  }

  @LogToLocal()
  public fetchNetworkFromServer() {
    return {};
  }

  @LogToLocal()
  public insertServerNetwork(networks: IServerNetwork[]) {
    return networks.map((network) => ({
      name: network.name,
      chainId: network.chainId,
    }));
  }

  @LogToLocal()
  public getServerNetworks(networks: IServerNetwork[]) {
    return networks.map((network) => ({
      name: network.name,
      chainId: network.chainId,
    }));
  }
}
