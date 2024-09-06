import { groupOfAddress } from '@alephium/web3';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { IEncodedTxAlph } from '@onekeyhq/core/src/chains/alph/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IConnectedAccountInfo } from '@onekeyhq/shared/types/dappConnection';
import type { EMessageTypesAlph } from '@onekeyhq/shared/types/message';

import { deserializeUnsignedTransaction } from '../vaults/impls/alph/sdkAlph/utils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  Account,
  EnableOptionsBase,
  SignMessageParams,
  SignTransferTxResult,
  SignUnsignedTxParams,
} from '@alephium/web3';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiAlph extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ton;

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

  @permissionRequired()
  @providerApiMethod()
  public async signAndSubmitTransferTx(
    request: IJsBridgeMessagePayload,
    params: IEncodedTxAlph,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const accounts = await this.getAccountsInfo(request);
    const { account, accountInfo } = accounts[0];
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: params,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    const encodedTx = result.encodedTx as IEncodedTxAlph;
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
      gasPrice: encodedTx.params.gasPrice || '0',
      gasAmount: encodedTx.params.gasAmount || 0,
      fromGroup: decodedUnsignedTx.fromGroup,
      toGroup: decodedUnsignedTx.toGroup,
    };
    return res;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signUnsignedTx(
    request: IJsBridgeMessagePayload,
    params: SignUnsignedTxParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accounts = await this.getAccountsInfo(request);
    const { account, accountInfo } = accounts[0];
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: params as any,
        signOnly: true,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    return result.rawTx;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: SignMessageParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
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

    return Promise.resolve({
      signature: result,
    });
  }
}

export default ProviderApiAlph;
