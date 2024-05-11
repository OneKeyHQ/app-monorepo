/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { getPublicKey } from '../vaults/impls/near/utils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type ProviderApiPrivate from './ProviderApiPrivate';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiNear extends ProviderApiBase {
  public providerName = IInjectedProviderNames.near;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.near_accounts({ origin });
      const result = {
        method: 'wallet_events_accountsChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.near_network({ origin });
      const result = {
        method: 'wallet_events_chainChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

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

  @providerApiMethod()
  public async near_accounts(request: IJsBridgeMessagePayload): Promise<{
    accounts: {
      accountId: string;
      publicKey: string;
      allKeys?: string[];
    }[];
  }> {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve({ accounts: [] });
    }
    return Promise.resolve({
      accounts: accountsInfo.map((i) => ({
        accountId: i.account?.address,
        publicKey: getPublicKey({ accountPub: i.account.pub }),
        allKeys: [],
      })),
    });
  }

  @providerApiMethod()
  public async near_network(request: IJsBridgeMessagePayload): Promise<{
    networkId: string;
    nodeUrls: string[];
  }> {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );

    if (networks[0]) {
      return {
        networkId: networks[0].isTestnet ? 'testnet' : 'mainnet',
        nodeUrls: [],
      };
    }

    return {
      networkId: '',
      nodeUrls: [],
    };
  }

  @providerApiMethod()
  public near_networkInfo(request: IJsBridgeMessagePayload) {
    return this.near_network(request);
  }

  @providerApiMethod()
  public async near_requestAccounts(request: IJsBridgeMessagePayload) {
    console.log('ProviderApiNear.near_requestAccounts', request);
    const res = await this.near_accounts(request);
    if (res.accounts && res.accounts.length) {
      return res;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.near_accounts(request);
  }

  @providerApiMethod()
  public near_requestSignIn(request: IJsBridgeMessagePayload) {
    return this.near_requestAccounts(request);
  }

  // signOut, sign out, logOut, log out, disconnect
  @providerApiMethod()
  public async near_signOut(
    request: IJsBridgeMessagePayload,
    accountInfo: { accountId?: string },
  ) {
    const { origin } = request;
    if (!origin || !accountInfo.accountId) {
      return false;
    }
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
    });
    return true;
  }

  @permissionRequired()
  @providerApiMethod()
  public async near_requestSignTransactions(
    request: IJsBridgeMessagePayload,
    params: {
      transactions: string[];
      meta: Record<string, any>;
      send: boolean;
    },
  ): Promise<{ transactionHashes: string[] }> {
    const { transactions } = params;
    const transactionHashes: string[] = [];
    // TODO: need request queue
    return { transactionHashes };
  }

  @permissionRequired()
  @providerApiMethod()
  public near_signTransactions() {
    throw web3Errors.rpc.methodNotFound();
  }

  @permissionRequired()
  @providerApiMethod()
  public async near_sendTransactions(
    request: IJsBridgeMessagePayload,
    params: {
      transactions: string[];
      meta: Record<string, any>;
      send: boolean;
    },
  ) {
    return this.near_requestSignTransactions(request, params);
  }

  @permissionRequired()
  @providerApiMethod()
  public near_requestSignMessages() {
    throw web3Errors.rpc.methodNotFound();
  }

  @permissionRequired()
  @providerApiMethod()
  public near_signMessages() {
    throw web3Errors.rpc.methodNotFound();
  }

  @providerApiMethod()
  wallet_getConnectWalletInfo(request: IJsBridgeMessagePayload) {
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    return privateProvider.wallet_getConnectWalletInfo(request);
  }

  @providerApiMethod()
  wallet_sendSiteMetadata() {
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    return privateProvider.wallet_sendSiteMetadata();
  }
}

export default ProviderApiNear;
