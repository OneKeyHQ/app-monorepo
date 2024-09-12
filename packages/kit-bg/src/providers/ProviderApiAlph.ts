import { groupOfAddress } from '@alephium/web3';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { EAlphTxType } from '@onekeyhq/core/src/chains/alph/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IConnectedAccountInfo } from '@onekeyhq/shared/types/dappConnection';
import type { EMessageTypesAlph } from '@onekeyhq/shared/types/message';

import {
  deserializeUnsignedTransaction,
  serializeUnsignedTransaction,
} from '../vaults/impls/alph/sdkAlph/utils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  Account,
  EnableOptionsBase,
  SignDeployContractTxParams,
  SignDeployContractTxResult,
  SignExecuteScriptTxParams,
  SignExecuteScriptTxResult,
  SignMessageParams,
  SignMessageResult,
  SignTransferTxParams,
  SignTransferTxResult,
  SignUnsignedTxParams,
  SignUnsignedTxResult,
} from '@alephium/web3';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiAlph extends ProviderApiBase {
  public providerName = IInjectedProviderNames.alephium;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.account({ origin, scope: this.providerName });
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async () => {
      const params = await this.network();
      const result = {
        method: 'wallet_events_networkChange',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  private wrapperConnectAccount(account: IConnectedAccountInfo): Account {
    return {
      address: account.account.address,
      publicKey: account.account.pub ?? '',
      group: groupOfAddress(account.account.address),
      keyType: 'default',
    };
  }

  private checkEnableParams(params?: EnableOptionsBase) {
    if (params) {
      if (
        (params.keyType && params.keyType !== 'default') ||
        (params.networkId && params.networkId !== 'mainnet')
      ) {
        throw web3Errors.rpc.methodNotSupported();
      }
      if (params.addressGroup !== undefined && params.addressGroup !== 0) {
        throw new Error('Only address group 0 is supported');
      }
    }
  }

  private async account(
    request: IJsBridgeMessagePayload,
    params?: EnableOptionsBase,
  ) {
    this.checkEnableParams(params);
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );

    if (!accountsInfo || accountsInfo.length === 0) {
      return undefined;
    }
    return this.wrapperConnectAccount(accountsInfo[0]);
  }

  @providerApiMethod()
  public async enable(
    request: IJsBridgeMessagePayload,
    params: EnableOptionsBase,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const accountInfo = await this.account(request, params);
    if (accountInfo) {
      return accountInfo;
    }

    await this.backgroundApi.serviceDApp.openConnectionModal(request);

    const accountsInfo = await this.getAccountsInfo(request);
    return this.wrapperConnectAccount(accountsInfo[0]);
  }

  @providerApiMethod()
  public async disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: request.isWalletConnectRequest
        ? 'walletConnect'
        : 'injectedProvider',
    });
  }

  @providerApiMethod()
  public async isPreauthorized(
    request: IJsBridgeMessagePayload,
    params: EnableOptionsBase,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accountInfo = await this.account(request, params);
    return !!accountInfo;
  }

  @providerApiMethod()
  public async enableIfConnected(
    request: IJsBridgeMessagePayload,
    params: EnableOptionsBase,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accountInfo = await this.account(request, params);
    return accountInfo;
  }

  @providerApiMethod()
  public async unsafeEnable(
    request: IJsBridgeMessagePayload,
    params: EnableOptionsBase,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    this.checkEnableParams(params);
    await this.backgroundApi.serviceDApp.openConnectionModal(request);

    const accountsInfo = await this.getAccountsInfo(request);
    return this.wrapperConnectAccount(accountsInfo[0]);
  }

  @providerApiMethod()
  public async network(): Promise<string> {
    return Promise.resolve('mainnet');
  }

  @providerApiMethod()
  public async unsafeGetSelectedAccount(
    request: IJsBridgeMessagePayload,
  ): Promise<Account> {
    const accountsInfo = await this.getAccountsInfo(request);
    return this.wrapperConnectAccount(accountsInfo[0]);
  }

  @providerApiMethod()
  public async getSelectedAccount(
    request: IJsBridgeMessagePayload,
  ): Promise<Account> {
    const accountsInfo = await this.getAccountsInfo(request);
    return this.wrapperConnectAccount(accountsInfo[0]);
  }

  private parseParams<T>(paramsString: string | T): T {
    if (typeof paramsString === 'string') {
      try {
        return JSON.parse(paramsString) as T;
      } catch (error) {
        return paramsString as unknown as T;
      }
    }
    return paramsString;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndSubmitTransferTx(
    request: IJsBridgeMessagePayload,
    paramsString: string | SignTransferTxParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const params = this.parseParams(paramsString);
    const accounts = await this.getAccountsInfo(request);
    const { account, accountInfo } = accounts[0];
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: {
          type: EAlphTxType.Transfer,
          params,
        },
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    const rawTx = JSON.parse(result.rawTx) as {
      unsignedTx: string;
      signature: string;
    };
    const decodedUnsignedTx = await deserializeUnsignedTransaction({
      unsignedTx: rawTx.unsignedTx,
      backgroundApi: this.backgroundApi,
      networkId: accountInfo?.networkId ?? '',
    });
    const res: SignTransferTxResult = {
      ...rawTx,
      txId: result.txid,
      gasPrice: decodedUnsignedTx.unsignedTx.gasPrice,
      gasAmount: decodedUnsignedTx.unsignedTx.gasAmount,
      fromGroup: decodedUnsignedTx.fromGroup,
      toGroup: decodedUnsignedTx.toGroup,
    };
    return res;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndSubmitDeployContractTx(
    request: IJsBridgeMessagePayload,
    paramsString: string | SignDeployContractTxParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const params = this.parseParams(paramsString);
    const accounts = await this.getAccountsInfo(request);
    const { account, accountInfo } = accounts[0];
    const encodedTx = {
      type: EAlphTxType.DeployContract,
      params,
    };
    const deployTxInfo = (await serializeUnsignedTransaction({
      encodedTx,
      publicKey: account.pub ?? '',
      networkId: accountInfo?.networkId ?? '',
      backgroundApi: this.backgroundApi,
    })) as Omit<SignDeployContractTxResult, 'signature'>;

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    const rawTx = JSON.parse(result.rawTx) as {
      unsignedTx: string;
      signature: string;
    };

    const res: SignDeployContractTxResult = {
      ...deployTxInfo,
      ...rawTx,
      gasPrice: deployTxInfo.gasPrice.toString(),
    };
    return res;
  }

  @providerApiMethod()
  public async signAndSubmitExecuteScriptTx(
    request: IJsBridgeMessagePayload,
    paramsString: string | SignExecuteScriptTxParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const params = this.parseParams(paramsString);
    const accounts = await this.getAccountsInfo(request);
    const { account, accountInfo } = accounts[0];
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: {
          type: EAlphTxType.ExecuteScript,
          params,
        },
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    const rawTx = JSON.parse(result.rawTx) as {
      unsignedTx: string;
      signature: string;
    };
    const decodedUnsignedTx = await deserializeUnsignedTransaction({
      unsignedTx: rawTx.unsignedTx,
      backgroundApi: this.backgroundApi,
      networkId: accountInfo?.networkId ?? '',
    });
    const res: SignExecuteScriptTxResult = {
      ...rawTx,
      txId: result.txid,
      gasPrice: decodedUnsignedTx.unsignedTx.gasPrice,
      gasAmount: decodedUnsignedTx.unsignedTx.gasAmount,
      groupIndex: decodedUnsignedTx.fromGroup,
    };
    return res;
  }

  private async _signUnsignedTx(
    request: IJsBridgeMessagePayload,
    params: SignUnsignedTxParams,
    signOnly: boolean,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accounts = await this.getAccountsInfo(request);
    const { account, accountInfo } = accounts[0];
    const decodedUnsignedTx = await deserializeUnsignedTransaction({
      unsignedTx: params.unsignedTx,
      backgroundApi: this.backgroundApi,
      networkId: accountInfo?.networkId ?? '',
    });
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: {
          type: EAlphTxType.UnsignedTx,
          params: {
            ...params,
            gasAmount: decodedUnsignedTx.unsignedTx.gasAmount,
            gasPrice: decodedUnsignedTx.unsignedTx.gasPrice,
          },
        },
        signOnly,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });
    const res: SignUnsignedTxResult = {
      gasPrice: decodedUnsignedTx.unsignedTx.gasPrice,
      gasAmount: decodedUnsignedTx.unsignedTx.gasAmount,
      fromGroup: decodedUnsignedTx.fromGroup,
      toGroup: decodedUnsignedTx.toGroup,
      unsignedTx: params.unsignedTx,
      txId: result.txid,
      signature: result.signature as string,
    };
    return res;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndSubmitUnsignedTx(
    request: IJsBridgeMessagePayload,
    paramsString: string | SignUnsignedTxParams,
  ) {
    const params = this.parseParams(paramsString);
    return this._signUnsignedTx(request, params, false);
  }

  @permissionRequired()
  @providerApiMethod()
  public async signUnsignedTx(
    request: IJsBridgeMessagePayload,
    paramsString: string | SignUnsignedTxParams,
  ) {
    const params = this.parseParams(paramsString);
    return this._signUnsignedTx(request, params, true);
  }

  @permissionRequired()
  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    paramsString: string | SignMessageParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const params = this.parseParams(paramsString);
    const accounts = await this.getAccountsInfo(request);
    const { account, accountInfo } = accounts[0];

    const result = (await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: params.messageHasher as EMessageTypesAlph,
        message: params.message,
      },
      accountId: account.id ?? '',
      networkId: accountInfo?.networkId ?? '',
    })) as string;

    const res: SignMessageResult = {
      signature: result,
    };
    return res;
  }
}

export default ProviderApiAlph;
