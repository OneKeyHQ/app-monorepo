/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type VaultNear from '@onekeyhq/engine/src/vaults/impl/near/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_NEAR } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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
    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async () => {
      const params = await this.near_network();
      const result = {
        // TODO do not emit events to EVM Dapps, injected provider check scope
        method: 'wallet_events_chainChanged',
        params,
      };
      return result;
    };
    info.send(data);
  }

  public async rpcCall(request: IJsonRpcRequest) {
    const { networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_NEAR) {
      return;
    }
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
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
    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    const connectedAccounts =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin as string,
        impl: IMPL_NEAR,
      });
    if (!connectedAccounts) {
      return { accounts: [] };
    }
    if (networkImpl !== IMPL_NEAR) {
      return { accounts: [] };
    }
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultNear;
    const address = await vault.getAccountAddress();
    const addresses = connectedAccounts.map((account) => account.address);
    if (!addresses.includes(address)) {
      return { accounts: [] };
    }
    const publicKey = await vault._getPublicKey();
    return {
      accounts: [
        {
          accountId: address,
          publicKey,
          allKeys: [],
        },
      ],
    };
  }

  @providerApiMethod()
  public async near_network(): Promise<{
    networkId: string;
    nodeUrls: string[];
  }> {
    const { networkId } = getActiveWalletAccount();
    const network = await this.backgroundApi.engine.getNetwork(networkId);
    return {
      networkId: network.isTestnet ? 'testnet' : 'mainnet',
      nodeUrls: [network.rpcURL],
    };
  }

  @providerApiMethod()
  public near_networkInfo() {
    return this.near_network();
  }

  @providerApiMethod()
  public async near_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info(
      'ProviderApiNear.near_requestAccounts',
      request,
    );
    const res = await this.near_accounts(request);
    if (res.accounts && res.accounts.length) {
      return res;
    }
    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return this.near_accounts(request);
  }

  @providerApiMethod()
  public near_requestSignIn(request: IJsBridgeMessagePayload) {
    return this.near_requestAccounts(request);
  }

  // signOut, sign out, logOut, log out, disconnect
  @providerApiMethod()
  public near_signOut(
    request: IJsBridgeMessagePayload,
    accountInfo: { accountId?: string },
  ) {
    const { origin } = request;
    if (!origin || !accountInfo.accountId) {
      return false;
    }
    this.backgroundApi.serviceDapp.removeConnectedAccounts({
      origin,
      networkImpl: IMPL_NEAR,
      addresses: [accountInfo.accountId],
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
    for (let i = 0; i < transactions.length; i += 1) {
      await this.backgroundApi.serviceDapp.processBatchTransactionOneByOne({
        run: async () => {
          const tx = transactions[i];
          const result =
            (await this.backgroundApi.serviceDapp.openSignAndSendModal(
              request,
              { encodedTx: tx },
            )) as string;
          transactionHashes.push(result);
        },
      });
    }
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
  wallet_getConnectWalletInfo(req: IJsBridgeMessagePayload) {
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    return privateProvider.wallet_getConnectWalletInfo(req);
  }

  @providerApiMethod()
  wallet_sendSiteMetadata() {
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    return privateProvider.wallet_sendSiteMetadata();
  }
}

export default ProviderApiNear;
