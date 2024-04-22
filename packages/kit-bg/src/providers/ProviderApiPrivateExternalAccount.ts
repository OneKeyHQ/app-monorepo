import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export type IPrivateBTCExternalAccount = {
  address: string;
  coinType: string;
  path: string;
  pub: string;
};

@backgroundClass()
class ProviderApiPrivateExternalAccount extends ProviderApiBase {
  // public providerName = IInjectedProviderNames.$privateExternalAccount;
  public providerName = '$privateExternalAccount' as any;

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
      return accounts[0];
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    const newAccounts = await this.getAccounts(request);
    if (newAccounts && newAccounts.length) {
      return newAccounts[0];
    }
    throw new Error('No account found');
  }

  @providerApiMethod()
  async getAccounts(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      accountsInfo.map(
        (i) =>
          ({
            address: i.account.address,
            coinType: i.account.coinType,
            path: i.account.path,
            // @ts-expect-error
            pub: i.account.xpubSegwit,
          } as IPrivateBTCExternalAccount),
      ),
    );
  }
}

export default ProviderApiPrivateExternalAccount;
