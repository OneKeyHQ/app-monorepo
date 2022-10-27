import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { SignedTransaction } from 'tronweb';

import { IMPL_TRON } from '@onekeyhq/engine/src/constants';
import VaultTron from '@onekeyhq/engine/src/vaults/impl/tron/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getActiveWalletAccount } from '../../hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

export type WatchAssetParameters = {
  type: string;
  options: {
    address: string;
    symbol?: string;
    decimals?: number;
    image?: string;
  };
};

@backgroundClass()
class ProviderApiTron extends ProviderApiBase {
  public providerName = IInjectedProviderNames.tron;

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountsChanged',
        params: await this.tron_accounts({ origin }),
      };
      return result;
    };
    info.send(data);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async () => {
      const result = {
        method: 'wallet_events_nodesChanged',
        params: await this.tron_nodes(),
      };
      return result;
    };
    info.send(data);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_TRON) {
      return;
    }

    debugLogger.providerApi.info('tron rpcCall:', request, { networkId });
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
    debugLogger.providerApi.info('tron rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  // ----------------------------------------------

  @providerApiMethod()
  async tron_getProviderState(request: IJsBridgeMessagePayload) {
    const [accounts, nodes] = await Promise.all([
      this.tron_accounts(request),
      this.tron_nodes(),
    ]);
    return {
      accounts,
      nodes,
    };
  }

  @providerApiMethod()
  async tron_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_TRON,
      },
    );
    if (!accounts) {
      return Promise.resolve([]);
    }
    const accountAddresses = accounts.map((account) => account.address);
    return Promise.resolve(accountAddresses);
  }

  async tron_nodes() {
    const { accountId, networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_TRON) {
      return {};
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultTron;

    const network = await vault.getNetwork();

    return Promise.resolve({
      fullHost: network.rpcURL,
      fullNode: network.rpcURL,
      solidityNode: network.rpcURL,
      eventServer: network.rpcURL,
    });
  }

  @providerApiMethod()
  async tron_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info(
      'ProviderTronConflux.tron_requestAccounts',
      request,
    );

    const accounts = await this.tron_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return this.tron_accounts(request);
  }

  @permissionRequired()
  @providerApiMethod()
  async tron_signTransaction(
    request: IJsBridgeMessagePayload,
    transaction: any,
  ): Promise<SignedTransaction> {
    debugLogger.providerApi.info('tron_signTransaction', request, transaction);
    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx: transaction,
        signOnly: true,
      },
    );

    debugLogger.providerApi.info(
      'tron_signTransaction DONE',
      result,
      request,
      transaction,
    );

    return JSON.parse(result as string) as SignedTransaction;
  }

  @providerApiMethod()
  async wallet_requestPermissions(request: IJsBridgeMessagePayload) {
    return this.tron_requestAccounts(request);
  }

  @permissionRequired()
  @providerApiMethod()
  async wallet_watchAsset(
    request: IJsBridgeMessagePayload,
    params: WatchAssetParameters,
  ) {
    const type = (params.type ?? '').toUpperCase();
    if (type !== 'TRC20') {
      throw new Error(`Asset of type '${type}' not supported`);
    }
    const result = await this.backgroundApi.serviceDapp?.openAddTokenModal(
      request,
      params,
    );
    return result;
  }
}

export default ProviderApiTron;
