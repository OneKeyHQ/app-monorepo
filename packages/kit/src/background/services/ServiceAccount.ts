import { Account } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';

import { changeActiveAccount } from '../../store/reducers/general';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiBase from '../providers/ProviderApiBase';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAccount extends ServiceBase {
  @backgroundMethod()
  changeActiveAccount({
    account,
    wallet,
  }: {
    account: Account | null;
    wallet: Wallet | null;
  }) {
    this.backgroundApi.dispatch(changeActiveAccount({ account, wallet }));
    this.notifyAccountsChanged();
  }

  @backgroundMethod()
  notifyAccountsChanged(): void {
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappAccountsChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
        });
      },
    );
    this.backgroundApi.walletConnect.notifySessionChanged();
  }
}

export default ServiceAccount;
