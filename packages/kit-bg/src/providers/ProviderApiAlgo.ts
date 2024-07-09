import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiAlgo extends ProviderApiBase {
  public providerName = IInjectedProviderNames.algo;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.accounts({ origin, scope: this.providerName });
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
      const params = await this.getChainId({
        origin,
        scope: this.providerName,
      });
      const result = {
        method: 'wallet_events_chainChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getChainId(request: IJsBridgeMessagePayload) {
    console.log('algo getChainId');

    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );

    if (!accountsInfo || !accountsInfo.length) {
      return undefined;
    }
    const { accountInfo: { networkId } = {} } = accountsInfo[0];

    if (networkId) {
      return networkId.split(SEPERATOR)[1];
    }
  }

  @providerApiMethod()
  public async accounts(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account?.address));
  }

  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload) {
    console.log('algo connect', request);
    const accounts = await this.accounts(request);

    if (accounts && accounts.length > 0) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.accounts(request);
  }

  @permissionRequired()
  @providerApiMethod()
  public async algo_signTxn(
    request: IJsBridgeMessagePayload,
    walletTransactions: Array<{ txn: string; signers: [] }>,
  ): Promise<(string | null)[]> {
    const txsToSign: string[] = [];
    for (let i = 0; i < walletTransactions.length; i += 1) {
      // transaction with signers means that this transaction is not meant to be signed
      if (!Array.isArray(walletTransactions[i].signers)) {
        txsToSign.push(walletTransactions[i].txn);
      }
    }

    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: txsToSign,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        signOnly: true,
      });

    const signedTxs = result.rawTx?.split(',');

    return walletTransactions.map((tx) => {
      if (Array.isArray(tx.signers)) {
        return null;
      }
      return signedTxs.shift() ?? null;
    });
  }
}

export default ProviderApiAlgo;
