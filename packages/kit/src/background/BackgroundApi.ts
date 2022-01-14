import cloneDeep from 'lodash/cloneDeep';

import { internalMethod } from '@onekeyhq/inpage-provider/src/provider/decorators';
import { IJsonRpcRequest } from '@onekeyhq/inpage-provider/src/types';

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
    } as IJsonRpcRequest);
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

    this.notifyAccountsChanged();
  }

  // @ts-expect-error
  @internalMethod()
  changeChain(chainId: string, networkVersion?: string) {
    this.walletApi.chainId = chainId;
    // TODO networkVersion EVM Only
    // eslint-disable-next-line no-param-reassign
    networkVersion = networkVersion ?? `${parseInt(chainId, 16)}`;
    this.walletApi.networkVersion = networkVersion;

    this.notifyChainChanged();
  }

  // @ts-expect-error
  @internalMethod()
  notifyAccountsChanged(): void {
    const address = this.walletApi.selectedAddress;

    Object.values(this.providers).forEach((provider: ProviderApiBase) => {
      provider.notifyDappAccountsChanged({
        address,
        send: this.sendForProvider(provider.providerName),
      });
    });
  }

  // @ts-expect-error
  @internalMethod()
  notifyChainChanged(): void {
    const { chainId, networkVersion } = this.walletApi;
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
