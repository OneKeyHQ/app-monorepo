import cloneDeep from 'lodash/cloneDeep';

import { internalMethod } from '@onekeyhq/inpage-provider/src/provider/decorators';
import { IInpageProviderRequestData } from '@onekeyhq/inpage-provider/src/types';

import store from '../store';

import BackgroundApiBase from './BackgroundApiBase';
import { IBackgroundApi } from './BackgroundApiProxy';
import ProviderApiBase from './ProviderApiBase';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  get accounts() {
    return this.walletApi.accounts;
  }

  // @ts-expect-error
  @internalMethod()
  dispatchAction(action: any) {
    // * update background store
    // TODO init store from constructor
    store.dispatch(action);
    // * broadcast action
    this.bridgeExtBg?.requestToAllUi({
      // TODO use consts
      method: 'dispatchActionBroadcast',
      params: action,
    } as IInpageProviderRequestData);
    // * TODO async action
    // * TODO auto sync full state to UI when ui mount
  }

  // @ts-expect-error
  @internalMethod()
  getStoreState(): Promise<any> {
    const state = cloneDeep(store.getState());
    return Promise.resolve(state);
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
