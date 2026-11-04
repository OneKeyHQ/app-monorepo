import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import sdkAlgo from '@onekeyhq/core/src/chains/algo/sdkAlgo';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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
    // console.log('algo getChainId');

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
    defaultLogger.discovery.dapp.dappRequest({ request });
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
    walletTransactions: Array<{
      txn: string;
      signers?: string[];
      authAddr?: string;
      // oxlint-disable-next-line @cspell/spellchecker
      msig?: unknown;
    }>,
  ): Promise<(string | null)[]> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { account, accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const txsToSign: string[] = [];
    for (let i = 0; i < walletTransactions.length; i += 1) {
      const tx = walletTransactions[i];
      // ARC-1 uses an empty signers array for transactions signed by another party.
      if (!(Array.isArray(tx.signers) && tx.signers.length === 0)) {
        // oxlint-disable-next-line @cspell/spellchecker
        if (tx.authAddr !== undefined || tx.msig !== undefined) {
          throw web3Errors.provider.unsupportedMethod(
            'Rekeyed and multisig transactions are not supported',
          );
        }
        if (tx.signers !== undefined) {
          if (!Array.isArray(tx.signers) || tx.signers.length !== 1) {
            throw web3Errors.rpc.invalidParams('Expected one signing account');
          }
          this.assertAccountAddress(account, tx.signers[0]);
        }
        const transaction = sdkAlgo.decodeUnsignedTransaction(
          Buffer.from(tx.txn, 'base64'),
        );
        this.assertAccountAddress(
          account,
          sdkAlgo.encodeAddress(transaction.from.publicKey),
        );
        txsToSign.push(tx.txn);
      }
    }

    if (txsToSign.length === 0) {
      return walletTransactions.map(() => null);
    }

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
      if (Array.isArray(tx.signers) && tx.signers.length === 0) {
        return null;
      }
      return signedTxs.shift() ?? null;
    });
  }
}

export default ProviderApiAlgo;
