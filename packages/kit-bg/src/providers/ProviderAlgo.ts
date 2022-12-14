import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

import VaultAlgo from '@onekeyhq/engine/src/vaults/impl/algo/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_ALGO } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

@backgroundClass()
class ProviderApiAlgo extends ProviderApiBase {
  public providerName = IInjectedProviderNames.algo;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.accounts({ origin });
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
      const params = await this.getChainId();
      const result = {
        method: 'wallet_events_chainChanged',
        params,
      };
      return result;
    };
    info.send(data);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getChainId() {
    debugLogger.providerApi.info('algo getChainId');

    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    if (networkImpl !== IMPL_ALGO) {
      return;
    }
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAlgo;

    const chainId = await vault.getNetworkChainId();
    return Promise.resolve({ chainId });
  }

  @providerApiMethod()
  public async accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_ALGO,
      },
    );
    if (!accounts) {
      return Promise.resolve([]);
    }
    const accountAddresses = accounts.map((account) => account.address);
    return Promise.resolve(accountAddresses);
  }

  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info('algo connect', request);
    const accounts = await this.accounts(request);

    if (accounts && accounts.length > 0) {
      return accounts;
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);

    return this.accounts(request);
  }

  @permissionRequired()
  @providerApiMethod()
  public async algo_signTxn(
    request: IJsBridgeMessagePayload,
    walletTransactions: Array<{ txn: string; signers: [] }>,
  ): Promise<(string | null)[]> {
    const signedTxs: (string | null)[] = [];
    for (let i = 0; i < walletTransactions.length; i += 1) {
      // transaction with signers means that this transaction is not meant to be signed
      if (Array.isArray(walletTransactions[i].signers)) {
        signedTxs.push(null);
      } else {
        await this.backgroundApi.serviceDapp.processBatchTransactionOneByOne({
          run: async () => {
            const { txn } = walletTransactions[i];
            const result =
              await this.backgroundApi.serviceDapp.openSignAndSendModal(
                request,
                {
                  encodedTx: txn,
                  signOnly: true,
                },
              );
            signedTxs.push(result as string);
          },
        });
      }
    }

    return signedTxs;
  }
}

export default ProviderApiAlgo;
