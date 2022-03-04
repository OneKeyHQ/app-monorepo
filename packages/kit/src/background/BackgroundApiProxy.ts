/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import type { Engine } from '@onekeyhq/engine';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type {
  PromiseContainerCallbackCreate,
  PromiseContainerReject,
  PromiseContainerResolve,
} from './PromiseContainer';
import type PromiseContainer from './PromiseContainer';
import type DappService from './service/DappService';

const NOOP = {};

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  engine = NOOP as Engine;

  dappService = NOOP as DappService;

  promiseContainer = NOOP as PromiseContainer;

  // TODO add custom eslint rule to force method name match
  dispatchAction(action: any) {
    return this.callBackgroundSync('dispatchAction', action);
  }

  getStoreState(): Promise<any> {
    return this.callBackground('getStoreState');
  }

  changeAccounts(address: string): void {
    this.callBackgroundSync('changeAccounts', address);
  }

  changeChain(chainId: string, networkVersion?: string): void {
    this.callBackgroundSync('changeChain', chainId, networkVersion);
  }

  notifyAccountsChanged(): void {
    return this.callBackground('notifyAccountsChanged');
  }

  notifyChainChanged(): void {
    return this.callBackground('notifyChainChanged');
  }

  createPromiseCallback(params: PromiseContainerCallbackCreate): number {
    return this.callBackground('createPromiseCallback', params);
  }

  rejectPromiseCallback(params: PromiseContainerReject): void {
    return this.callBackground('rejectPromiseCallback', params);
  }

  resolvePromiseCallback(params: PromiseContainerResolve): void {
    return this.callBackground('resolvePromiseCallback', params);
  }

  listNetworks(...params: any) {
    return this.callBackground('listNetworks', ...params);
  }
}

export default BackgroundApiProxy;
