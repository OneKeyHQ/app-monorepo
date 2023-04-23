import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type VaultTron from '@onekeyhq/engine/src/vaults/impl/tron/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { SignedTransaction } from 'tronweb';

export type WatchAssetParameters = {
  type: string;
  options: {
    address: string;
    symbol?: string;
    decimals?: number;
    image?: string;
  };
};

const TRON_SCAN_REQUESTED_URL = {
  main: 'https://api.trongrid.io',
  shasta: 'https://api.shasta.trongrid.io',
};

const TRON_SCAN_HOST_WHITE_LIST = [
  'tronscan.org',
  'tronscan.io',
  'shasta.tronscan.org',
];

@backgroundClass()
class ProviderApiTron extends ProviderApiBase {
  public providerName = IInjectedProviderNames.tron;

  async tron_chainId() {
    const { accountId, networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_TRON) {
      return '0x0';
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultTron;

    const chainId = await vault.getNetworkChainId();
    return chainId;
  }

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
        params: {
          nodes: await this.tron_nodes(),
          chainId: await this.tron_chainId(),
        },
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
  async tron_getNodeInfo() {
    const { accountId, networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_TRON) {
      return {};
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultTron;

    const tronWeb = await vault.getClient();
    return tronWeb.trx.getNodeInfo();
  }

  @providerApiMethod()
  async tron_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_TRON,
      },
    );

    if (accounts && accounts.length > 0) {
      const accountAddresses = accounts.map((account) => account.address);
      return Promise.resolve(accountAddresses);
    }

    if (
      request.origin &&
      TRON_SCAN_HOST_WHITE_LIST.includes(new URL(request.origin).host)
    ) {
      const { accountAddress } = getActiveWalletAccount();
      this.backgroundApi.serviceDapp.saveConnectedAccounts({
        site: {
          origin: request.origin,
        },
        address: accountAddress,
        networkImpl: IMPL_TRON,
      });
      return Promise.resolve([accountAddress]);
    }
    return Promise.resolve([]);
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
    const url = network.isTestnet
      ? TRON_SCAN_REQUESTED_URL.shasta
      : TRON_SCAN_REQUESTED_URL.main;

    return Promise.resolve({
      fullHost: url,
      fullNode: url,
      solidityNode: url,
      eventServer: url,
    });
  }

  @providerApiMethod()
  async tron_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info('ProviderTron.tron_requestAccounts', request);
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
