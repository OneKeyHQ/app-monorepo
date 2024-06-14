import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { isNil } from 'lodash';
import { type SignedTransaction, TronWeb } from 'tronweb';

import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

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

  async tron_chainId(request: IJsBridgeMessagePayload) {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );
    if (!isNil(networks?.[0]?.chainId)) {
      return hexUtils.hexlify(Number(networks?.[0]?.chainId));
    }
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountsChanged',
        params: await this.tron_accounts({ origin, scope: this.providerName }),
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_nodesChanged',
        params: {
          nodes: await this.tron_nodes({
            origin,
            scope: this.providerName,
          }),
          chainId: await this.tron_chainId({
            origin,
            scope: this.providerName,
          }),
        },
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

  // ----------------------------------------------

  @providerApiMethod()
  async tron_getProviderState(request: IJsBridgeMessagePayload) {
    const [accounts, nodes] = await Promise.all([
      this.tron_accounts(request),
      this.tron_nodes(request),
    ]);
    return {
      accounts,
      nodes,
    };
  }

  @providerApiMethod()
  async tron_getNodeInfo(request: IJsBridgeMessagePayload) {
    const { fullHost } = await this.tron_nodes(request);

    const tronWeb = new TronWeb({ fullNode: fullHost });
    return tronWeb.trx.getNodeInfo();
  }

  @providerApiMethod()
  async tron_accounts(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account?.address));

    // TODO auto connect
    // if (
    //   request.origin &&
    //   TRON_SCAN_HOST_WHITE_LIST.includes(new URL(request.origin).host)
    // ) {
    //   const { accountAddress } = getActiveWalletAccount();
    //   this.backgroundApi.serviceDapp.saveConnectedAccounts({
    //     site: {
    //       origin: request.origin,
    //     },
    //     address: accountAddress,
    //     networkImpl: IMPL_TRON,
    //   });
    //   return Promise.resolve([accountAddress]);
    // }
    // return Promise.resolve([]);
  }

  async tron_nodes(request: IJsBridgeMessagePayload) {
    let url = '';

    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );

    if (networks[0]) {
      url = networks[0].isTestnet
        ? TRON_SCAN_REQUESTED_URL.shasta
        : TRON_SCAN_REQUESTED_URL.main;
    }

    return Promise.resolve({
      fullHost: url,
      fullNode: url,
      solidityNode: url,
      eventServer: url,
    });
  }

  @providerApiMethod()
  async tron_requestAccounts(request: IJsBridgeMessagePayload) {
    console.log('ProviderTron.tron_requestAccounts', request);
    const accounts = await this.tron_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.tron_accounts(request);
  }

  @permissionRequired()
  @providerApiMethod()
  async tron_signTransaction(
    request: IJsBridgeMessagePayload,
    transaction: any,
  ): Promise<SignedTransaction> {
    console.log('tron_signTransaction', request, transaction);

    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: transaction,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });

    console.log('tron_signTransaction DONE', result, request, transaction);

    return JSON.parse(result.txid) as SignedTransaction;
  }

  @providerApiMethod()
  async wallet_watchAsset() {
    throw web3Errors.rpc.methodNotSupported();
  }
}

export default ProviderApiTron;
