/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import type { Engine } from '@onekeyhq/engine';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type PromiseContainer from './PromiseContainer';
import type DappService from './service/DappService';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  _proxyServiceCache = {} as any;

  engine = this._createProxyService('engine') as Engine;

  dappService = this._createProxyService('dappService') as DappService;

  promiseContainer = this._createProxyService(
    'promiseContainer',
  ) as PromiseContainer;

  _createProxyService(name = 'ROOT') {
    const NOOP = new Proxy(
      {},
      {
        get: (target, prop) => {
          const key = `${name}.${prop as string}`;
          if (!this._proxyServiceCache[key]) {
            this._proxyServiceCache[key] = (...args: any) => {
              console.log('proxy method call', key, ...args);
              return this.callBackground(key, ...args);
            };
          }
          return this._proxyServiceCache[key];
        },
      },
    );
    return NOOP;
  }

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

  listNetworks(...params: any) {
    return this.callBackground('listNetworks', ...params);
  }
}

export default BackgroundApiProxy;
