import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import cloneDeep from 'lodash/cloneDeep';
import isFunction from 'lodash/isFunction';

import { Engine } from '@onekeyhq/engine';

import store from '../store';

import BackgroundApiBase from './BackgroundApiBase';
import { backgroundMethod } from './decorators';
import { IBackgroundApi } from './IBackgroundApi';
import PromiseContainer from './PromiseContainer';
import ProviderApiBase from './ProviderApiBase';
import DappService from './service/DappService';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  engine: Engine = new Engine();

  promiseContainer: PromiseContainer = new PromiseContainer();

  dappService = new DappService({
    backgroundApi: this,
  });

  @backgroundMethod()
  dispatchAction(action: any) {
    if (isFunction(action)) {
      throw new Error(
        'backgroundApi.dispatchAction ERROR:  async action is NOT allowed.',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    action.$isDispatchFromBackground = true;

    // * update background store
    // TODO init store from constructor
    store.dispatch(action);
    // * broadcast action
    this.bridgeExtBg?.requestToAllUi({
      // TODO use consts
      method: 'dispatchActionBroadcast',
      params: action,
    } as IJsonRpcRequest);
    // * TODO auto sync full state to UI when ui mount
  }

  @backgroundMethod()
  getStoreState(): Promise<any> {
    const state = cloneDeep(store.getState());
    return Promise.resolve(state);
  }

  // ----------------------------------------------

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
    Object.values(this.providers).forEach((provider: ProviderApiBase) => {
      provider.notifyDappAccountsChanged({
        send: this.sendForProvider(provider.providerName),
      });
    });
  }

  @backgroundMethod()
  notifyChainChanged(): void {
    Object.values(this.providers).forEach((provider: ProviderApiBase) => {
      provider.notifyDappChainChanged({
        send: this.sendForProvider(provider.providerName),
      });
    });
  }

  @backgroundMethod()
  listNetworks(...params: any) {
    return this.engine.listNetworks(...params);
  }
}
export default BackgroundApi;
