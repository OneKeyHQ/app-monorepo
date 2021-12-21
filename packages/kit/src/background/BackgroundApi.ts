import { internalMethod } from '@onekeyhq/inpage-provider/src/provider/decorators';

import BackgroundApiBase from './BackgroundApiBase';
import { IBackgroundApi } from './BackgroundApiProxy';
import ProviderApiBase from './ProviderApiBase';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  get accounts() {
    return this.walletApi.accounts;
  }

  // @ts-expect-error
  @internalMethod()
  changeAccounts(address: string) {
    this.walletApi.selectedAddress = address;

    Object.values(this.providers).forEach((provider: ProviderApiBase) => {
      provider.notifyDappAccountsChanged({
        address,
        send: this.sendMessagesToInjectedBridge,
      });
    });
  }

  // @ts-expect-error
  @internalMethod()
  changeChain(chainId: string) {
    this.walletApi.chainId = chainId;

    Object.values(this.providers).forEach((provider: ProviderApiBase) => {
      provider.notifyDappChainChanged({
        chainId,
        send: this.sendMessagesToInjectedBridge,
      });
    });
  }
}
export default BackgroundApi;
