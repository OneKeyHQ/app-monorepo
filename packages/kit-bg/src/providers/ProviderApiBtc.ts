import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import {
  ENetworkTypeEnum,
  NETWORK_TYPES,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiBtc.type';
import type {
  ISignMessageParams,
  ISwitchNetworkParams,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiBtc.type';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export const isBTCNetwork = (networkId?: string) =>
  networkId === OnekeyNetwork.btc || networkId === OnekeyNetwork.tbtc;

export function getNetworkName(network: IServerNetwork) {
  if (network && isBTCNetwork(network.id)) {
    if (network.isTestnet) {
      return Promise.resolve(NETWORK_TYPES[ENetworkTypeEnum.TESTNET].name);
    }
    return Promise.resolve(NETWORK_TYPES[ENetworkTypeEnum.MAINNET].name);
  }
}

@backgroundClass()
class ProviderApiBtc extends ProviderApiBase {
  public providerName = IInjectedProviderNames.btc;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this.getAccounts({
            origin,
            scope: this.providerName,
          }),
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new Error('Method not implemented.');
  }

  public async rpcCall(args: any): Promise<any> {
    console.log('===>args: ', args);
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getProviderState() {
    return {
      network: '',
      isUnlocked: true,
      accounts: [],
    };
  }

  // Provider API
  @providerApiMethod()
  public async requestAccounts(request: IJsBridgeMessagePayload) {
    const accounts = await this.getAccounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.getAccounts(request);
  }

  @providerApiMethod()
  async getAccounts(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getConnectedAccountsInfo(request);
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account.address));
  }

  @providerApiMethod()
  public async getPublicKey(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getConnectedAccountsInfo(request);
    if (!accountsInfo) {
      return Promise.resolve('');
    }
    return Promise.resolve(accountsInfo[0].account.pub);
  }

  @providerApiMethod()
  public async getNetwork(request: IJsBridgeMessagePayload) {
    if (!request.origin) {
      throw new Error('origin is required');
    }
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks({
      origin: request.origin ?? '',
      scope: request.scope ?? this.providerName,
    });
    if (Array.isArray(networks) && networks.length) {
      return getNetworkName(networks[0]);
    }
    return '';
  }

  @providerApiMethod()
  public async switchNetwork(
    request: IJsBridgeMessagePayload,
    params: ISwitchNetworkParams,
  ) {
    if (!request.origin) {
      throw new Error('origin is required');
    }
    console.log('ProviderApiBtc.switchNetwork');

    const { network: networkName } = params;
    let networkId;
    if (networkName === 'livenet') {
      networkId = OnekeyNetwork.btc;
    } else if (networkName === 'testnet') {
      networkId = OnekeyNetwork.tbtc;
    }
    if (!networkId) {
      throw web3Errors.provider.custom({
        code: 4000,
        message: `Unrecognized network ${networkName}.`,
      });
    }
    await this.backgroundApi.serviceDApp.switchConnectedNetwork({
      origin: request.origin,
      scope: request.scope ?? this.providerName,
      newNetworkId: networkId,
    });
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessageParams,
  ) {
    const { message, type } = params;
    const accountsInfo = await this.getConnectedAccountsInfo(request);
    if (!accountsInfo) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get current account`,
      });
    }
    const {
      accountInfo: { walletId, accountId, networkId },
    } = accountsInfo[0];

    if (walletId.startsWith('hw')) {
      throw web3Errors.provider.custom({
        code: 4003,
        message: 'Sign message is not supported on hardware.',
      });
    }

    if (type !== 'bip322-simple' && type !== 'ecdsa') {
      throw web3Errors.rpc.invalidParams('Invalid type');
    }

    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      accountId,
      networkId,
      unsignedMessage: {
        type,
        message,
        sigOptions: {
          noScriptType: true,
        },
        payload: {
          isFromDApp: true,
        },
        // signOnly: true,
      },
    });
    return Buffer.from(result as string, 'hex').toString('base64');
  }
}

export default ProviderApiBtc;
