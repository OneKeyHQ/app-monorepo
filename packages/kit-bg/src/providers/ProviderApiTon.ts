/* eslint-disable @typescript-eslint/no-unused-vars */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EMessageTypesTon } from '@onekeyhq/shared/types/message';

import {
  getAccountVersion,
  getWalletContractInstance,
} from '../vaults/impls/ton/sdkTon/utils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type {
  SignDataRequest,
  SignProofRequest,
} from '@onekeyfe/onekey-ton-provider';

enum ETonNetwork {
  Mainnet = '-239',
  Testnet = '-3',
}

@backgroundClass()
class ProviderApiTon extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ton;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ) {
    const data = async () => {
      const accounts =
        await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo({
          origin: info.targetOrigin,
          scope: this.providerName,
        });
      let params;
      try {
        if (accounts && accounts.length > 0) {
          params = await this._getAccountResponse(
            accounts[0].account,
            accounts[0].accountInfo?.networkId ?? '',
          );
        }
      } catch {
        // ignore
      }
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ) {
    const data = async () => {
      const accounts =
        await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo({
          origin: info.targetOrigin,
          scope: this.providerName,
        });
      const result = {
        method: 'wallet_events_networkChange',
        params: accounts ? accounts[0].accountInfo?.networkId : undefined,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
    this.notifyNetworkChangedToDappSite(info.targetOrigin);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload, params: string[]) {
    let accounts =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accounts || accounts.length === 0) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      accounts = await this.getAccountsInfo(request);
    }
    return this._getAccountResponse(
      accounts[0].account,
      accounts[0].accountInfo?.networkId ?? '',
    );
  }

  @providerApiMethod()
  public async disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
    });
  }

  @providerApiMethod()
  public async getDeviceInfo(request: IJsBridgeMessagePayload) {
    return {
      appName: 'OneKey',
      appVersion: platformEnv.version,
      maxProtocolVersion: 4,
      features: [
        { name: 'SendTransaction', maxMessages: 4 },
        // { name: 'SignData' }, // experimental feature
      ],
    };
  }

  private async _getAccountResponse(
    account: INetworkAccount,
    networkId: string,
  ) {
    const version = getAccountVersion(account.id);
    if (!account.pub) {
      throw new Error('Invalid account');
    }
    const wallet = getWalletContractInstance({
      version,
      publicKey: account.pub,
      backgroundApi: this.backgroundApi,
      networkId,
    });
    const deploy = await wallet.createStateInit();
    return {
      address: account.addressDetail.baseAddress,
      network: ETonNetwork.Mainnet,
      publicKey: account.pub,
      walletStateInit: Buffer.from(await deploy.stateInit.toBoc()).toString(
        'base64',
      ),
    };
  }

  @permissionRequired()
  @providerApiMethod()
  public async sendTransaction(
    request: IJsBridgeMessagePayload,
    encodedTx: IEncodedTxTon & {
      valid_until: number;
    },
  ): Promise<any> {
    const accounts = await this.getAccountsInfo(request);
    const account = accounts[0];
    if (encodedTx.from) {
      const fromAddr = new TonWeb.Address(encodedTx.from);
      if (
        fromAddr.toString(false, false, false) !==
        account.account.addressDetail.baseAddress
      ) {
        throw new Error('Invalid from address');
      }
    } else {
      encodedTx.from = account.account.addressDetail.baseAddress;
    }
    if (encodedTx.valid_until) {
      encodedTx.validUntil = encodedTx.valid_until;
    }
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        networkId: account.accountInfo?.networkId ?? '',
        accountId: account?.account.id ?? '',
        signOnly: false,
      });

    return result.txid;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signData(
    request: IJsBridgeMessagePayload,
    params: SignDataRequest,
  ): Promise<any> {
    const accounts = await this.getAccountsInfo(request);
    const account = accounts[0];
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      networkId: account?.accountInfo?.networkId ?? '',
      accountId: account?.account.id ?? '',
      unsignedMessage: {
        type: EMessageTypesTon.SIGN_DATA,
        message: Buffer.from(params.cell, 'base64').toString('hex'),
        payload: {
          schemaCrc: params.schema_crc,
          timestamp,
        },
      },
    });

    return {
      signature: result,
      timestamp,
    };
  }

  @permissionRequired()
  @providerApiMethod()
  public async signProof(
    request: IJsBridgeMessagePayload,
    params: SignProofRequest,
  ): Promise<any> {
    const accounts = await this.getAccountsInfo(request);
    const account = accounts[0];
    const timestamp = Math.floor(Date.now() / 1000);
    const appDomain = (request.origin ?? '').replace(/^(https?:\/\/)/, '');
    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      networkId: account?.accountInfo?.networkId ?? '',
      accountId: account?.account.id ?? '',
      unsignedMessage: {
        type: EMessageTypesTon.SIGN_PROOF,
        message: params.payload,
        payload: {
          isProof: true,
          timestamp,
          appDomain,
          address: account.account.address,
        },
      },
    });

    return {
      signature: Buffer.from(result as string, 'hex').toString('base64'),
      timestamp,
      domain: {
        lengthBytes: Buffer.from(appDomain).length,
        value: appDomain,
      },
    };
  }
}

export default ProviderApiTon;
