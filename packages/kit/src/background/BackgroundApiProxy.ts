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

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  proxyServiceCache = {} as any;

  createProxyService(name = 'ROOT') {
    const NOOP = new Proxy(
      {},
      {
        get: (target, prop) => {
          const key = `${name}.${prop as string}`;
          if (!this.proxyServiceCache[key]) {
            this.proxyServiceCache[key] = (...args: any) => {
              console.log('proxy method call', key, ...args);
              return this.callBackground(key, ...args);
            };
          }
          return this.proxyServiceCache[key];
        },
      },
    );
    return NOOP;
  }

  engine = this.createProxyService('engine') as Engine;

  dappService = this.createProxyService('dappService') as DappService;

  promiseContainer = this.createProxyService(
    'promiseContainer',
  ) as PromiseContainer;

  // TODO add custom eslint rule to force method name match
  dispatchAction(action: any) {
    this.callBackgroundSync('dispatchAction', action);
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
