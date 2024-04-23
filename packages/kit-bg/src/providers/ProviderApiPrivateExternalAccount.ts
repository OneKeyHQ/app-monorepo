import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export type IPrivateBTCExternalAccount = {
  address: string;
  coinType: string;
  path: string;
  xpub: string;
  template: string;
};

@backgroundClass()
class ProviderApiPrivateExternalAccount extends ProviderApiBase {
  public providerName = IInjectedProviderNames.$privateExternalAccount;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: { address: 'Your Account Address' },
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    return Promise.resolve();
  }

  // Provider API
  @providerApiMethod()
  async simpleMethod() {
    return Promise.resolve('Hello World');
  }

  @providerApiMethod()
  async btc_requestAccount(
    request: IJsBridgeMessagePayload,
  ): Promise<IPrivateBTCExternalAccount> {
    const accounts = await this.getAccounts(request);
    if (accounts && accounts.length) {
      return this.parseFirstAccount(accounts);
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    const newAccounts = await this.getAccounts(request);
    if (newAccounts && newAccounts.length) {
      return this.parseFirstAccount(accounts);
    }
    throw new Error('No account found');
  }

  @providerApiMethod()
  async getAccounts(request: IJsBridgeMessagePayload) {
    if (!request.origin) {
      throw new Error('origin is required');
    }
    const accountsInfo =
      await this.backgroundApi.serviceDApp.getConnectedAccounts({
        origin: request.origin ?? '',
        scope: request.scope,
        isWalletConnectRequest: request.isWalletConnectRequest,
        options: {
          networkImpl:
            // @ts-expect-error
            request.data?.network === 'testnet' ? IMPL_TBTC : IMPL_BTC,
        },
      });
    if (
      !accountsInfo ||
      (Array.isArray(accountsInfo) && !accountsInfo.length)
    ) {
      return Promise.resolve([]);
    }
    return accountsInfo;
  }

  private parseFirstAccount(
    accountsInfo: Awaited<ReturnType<typeof this.getAccounts>>,
  ): IPrivateBTCExternalAccount {
    if (accountsInfo && accountsInfo.length) {
      const account = accountsInfo[0].account;
      return {
        address: account.address,
        coinType: account.coinType,
        path: account.path,
        // @ts-expect-error
        xpub: account.xpub,
        template: account.template ?? '',
      };
    }
    return {} as IPrivateBTCExternalAccount;
  }

  @providerApiMethod()
  async btc_signTransaction(request: IJsBridgeMessagePayload) {
    console.log('===>sign data: ', request.data);
    const { encodedTx, network } = (
      request.data as {
        method: string;
        params: {
          encodedTx: IEncodedTxBtc;
          network: 'mainnet' | 'testnet';
        };
      }
    ).params;
    if (!network) {
      throw new Error('network is required');
    }
    if (!encodedTx) {
      throw new Error('encodedTx is required');
    }
    const accountsInfo = await this.getAccounts(request);
    const connectedAccount = accountsInfo[0];
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: connectedAccount.accountInfo.accountId,
        networkId: connectedAccount.accountInfo.networkId ?? '',
      });
    return result;
  }
}

export default ProviderApiPrivateExternalAccount;
