import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IWalletAddedEventParams,
  IWalletStartedParams,
} from '@onekeyhq/shared/types/analytics/onboarding';

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
  public addWalletStarted(params: IWalletStartedParams) {
    switch (params.addMethod) {
      case 'CreateWallet':
        return {
          addMethod: 'CreateWallet',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
        };

      case 'Import':
        return {
          addMethod: 'Import',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
          details: {
            importSource: params.details.importSource,
          },
        };

      case 'ConnectHardware':
        return {
          addMethod: 'ConnectHardware',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
          details: {
            hardwareWalletType: params.details.hardwareWalletType,
          },
        };

      case 'Connect3rdParty':
        return {
          addMethod: 'Connect3rdParty',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
        };

      default: {
        const _exhaustiveCheck: never = params;
        throw new Error(
          `Unreachable case: ${JSON.stringify(_exhaustiveCheck)}`,
        );
      }
    }
  }

  @LogToServer()
  @LogToLocal()
  public walletAdded(params: IWalletAddedEventParams) {
    switch (params.addMethod) {
      case 'CreateWallet':
        return {
          status: params.status,
          addMethod: 'CreateWallet',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
          details: {
            isBiometricSet: params.details.isBiometricSet,
          },
        };

      case 'Import':
        return {
          status: params.status,
          addMethod: 'Import',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
          details: {
            importSource: params.details.importSource,
          },
        };

      case 'ConnectHardware':
        return {
          status: params.status,
          addMethod: 'ConnectHardware',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
          details: {
            connectionType: params.details.connectionType,
            deviceType: params.details.deviceType,
            hardwareWalletType: params.details.hardwareWalletType,
            ...(params.details.firmwareVersions && {
              firmwareVersions: params.details.firmwareVersions,
            }),
          },
        };

      case 'Connect3rdParty':
        return {
          status: params.status,
          addMethod: 'Connect3rdParty',
          isSoftwareWalletOnlyUser: params.isSoftwareWalletOnlyUser,
          details: {
            protocol: params.details.protocol,
            network: params.details.network,
            ...(params.details.walletName && {
              walletName: params.details.walletName,
            }),
          },
        };

      default: {
        const _exhaustiveCheck: never = params;
        throw new Error(
          `Unreachable case: ${JSON.stringify(_exhaustiveCheck)}`,
        );
      }
    }
  }

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
  public deleteWallet() {}

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

  @LogToLocal()
  public getServerNetworksError(error: any) {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }

    return {
      error: errorMessage,
    };
  }
}
