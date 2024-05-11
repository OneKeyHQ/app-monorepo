/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import bs58 from 'bs58';
import isString from 'lodash/isString';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

type ISolanaSendOptions = {
  /** disable transaction verification step */
  skipPreflight?: boolean;
  /** preflight commitment level */
  preflightCommitment?: string;
  /** Maximum number of times for the RPC node to retry sending the transaction to the leader. */
  maxRetries?: number;
};

@backgroundClass()
class ProviderApiSolana extends ProviderApiBase {
  public providerName = IInjectedProviderNames.solana;

  _getConnectedAccountsPublicKey = async (
    request: IJsBridgeMessagePayload,
  ): Promise<{ publicKey: string }[]> => {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      accountsInfo.map((i) => ({ publicKey: i.account.address })),
    );
  };

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this._getConnectedAccountsPublicKey({ origin }),
        },
      };
      return result;
    };

    info.send(data, info.targetOrigin);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    console.log(info);
  }

  @providerApiMethod()
  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    const { data } = request;
    const { accountInfo: { networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const rpcRequest = data as IJsonRpcRequest;

    console.log(`${this.providerName} RpcCall=====>>>> : BgApi:`, request);

    const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: networkId ?? '',
      request: rpcRequest,
    });

    return result;
  }

  // ----------------------------------------------

  @providerApiMethod()
  public disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    void this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
    });
    console.log('solana disconnect', origin);
  }

  @providerApiMethod()
  public async signTransaction(
    request: IJsBridgeMessagePayload,
    params: { message: string },
  ) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    if (typeof params.message !== 'string') {
      throw web3Errors.rpc.invalidInput();
    }

    const rawTx =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        request,
        encodedTx: params.message,
        signOnly: true,
      })) as string;
    // Signed transaction is base64 encoded, inpage provider expects base58.
    return bs58.encode(Buffer.from(rawTx, 'base64'));
  }

  @providerApiMethod()
  public async signAllTransactions(
    request: IJsBridgeMessagePayload,
    params: { message: string[] },
  ) {
    // TODO: need request queue
    throw new Error('Method not implemented.');
  }

  @providerApiMethod()
  public async signAndSendTransaction(
    request: IJsBridgeMessagePayload,
    params: { message: string; options?: ISolanaSendOptions },
  ) {
    const { message } = params;

    if (!isString(message)) {
      throw web3Errors.rpc.invalidInput();
    }

    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const txid =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        request,
        encodedTx: message,
        signOnly: false,
      })) as string;
    console.log('solana signTransaction', request, params);
    return {
      signature: txid,
      publicKey: address ?? '',
    };
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: {
      message: string;
      display?: 'hex' | 'utf8';
    },
  ) {
    const { message, display = 'utf8' } = params;

    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    if (!isString(message) || !['utf8', 'hex'].includes(display)) {
      throw web3Errors.rpc.invalidInput();
    }

    console.log('solana signMessage', request, params);

    const signature = await this.backgroundApi.serviceDApp.openSignMessageModal(
      {
        request,
        unsignedMessage: {
          type: EMessageTypesCommon.SIGN_MESSAGE,
          message: bs58.decode(message).toString(),
        },
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      },
    );

    return { signature, publicKey: address ?? '' };
  }

  @providerApiMethod()
  public async connect(
    request: IJsBridgeMessagePayload,
    params?: { onlyIfTrusted: boolean },
  ) {
    debugger;
    const { onlyIfTrusted = false } = params || {};

    let publicKey = (await this._getConnectedAccountsPublicKey(request))[0];
    if (!publicKey && !onlyIfTrusted) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      publicKey = (await this._getConnectedAccountsPublicKey(request))[0];
    }

    if (!publicKey) {
      throw web3Errors.provider.userRejectedRequest();
    }

    return publicKey;
  }
}

export default ProviderApiSolana;
