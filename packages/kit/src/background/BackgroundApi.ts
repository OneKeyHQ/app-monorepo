import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import cloneDeep from 'lodash/cloneDeep';

import store from '../store';

import BackgroundApiBase from './BackgroundApiBase';
import { IBackgroundApi } from './BackgroundApiProxy';
import { backgroundMethod } from './decorators';
import ProviderApiBase from './ProviderApiBase';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  get accounts() {
    return this.walletApi.accounts;
  }

  @backgroundMethod()
  dispatchAction(action: any) {
    // * update background store
    // TODO init store from constructor
    store.dispatch(action);
    // * broadcast action
    this.bridgeExtBg?.requestToAllUi({
      // TODO use consts
      method: 'dispatchActionBroadcast',
      params: action,
    } as IJsonRpcRequest);
    // * TODO async action
    // * TODO auto sync full state to UI when ui mount
  }

  @backgroundMethod()
  getStoreState(): Promise<any> {
    const state = cloneDeep(store.getState());
    return Promise.resolve(state);
  }

  // TODO remove
  @backgroundMethod()
  changeAccounts(address: string) {
    console.log('changeAccounts', address);
    this.notifyAccountsChanged();
  }

  // TODO remove
  @backgroundMethod()
  changeChain(chainId: string, networkVersion?: string) {
    console.log('changeChain', { chainId, networkVersion });
    this.notifyChainChanged();
  }

  @backgroundMethod()
  notifyAccountsChanged(): void {
    const accounts = this.walletApi.getCurrentAccounts();

    Object.values(this.providers).forEach((provider: ProviderApiBase) => {
      provider.notifyDappAccountsChanged({
        accounts,
        send: this.sendForProvider(provider.providerName),
      });
    });
  }

  @backgroundMethod()
  notifyChainChanged(): void {
    const { chainId, networkVersion } = this.walletApi.getCurrentNetwork();
    Object.values(this.providers).forEach((provider: ProviderApiBase) => {
      provider.notifyDappChainChanged({
        chainId,
        networkVersion,
        send: this.sendForProvider(provider.providerName),
      });
    });
  }
}
export default BackgroundApi;
