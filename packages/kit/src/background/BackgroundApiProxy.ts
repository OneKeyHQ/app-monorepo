/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import type { Engine } from '@onekeyhq/engine';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type WalletConnectAdapter from './providers/WalletConnectAdapter';
import type ServiceAccount from './services/ServiceAccount';
import type ServiceApp from './services/ServiceApp';
import type ServiceCronJob from './services/ServiceCronJob';
import type ServiceDapp from './services/ServiceDapp';
import type ServiceNetwork from './services/ServiceNetwork';
import type ServiceOnboarding from './services/ServiceOnboarding';
import type ServicePromise from './services/ServicePromise';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  _proxyServiceCache = {} as any;

  engine = this._createProxyService('engine') as Engine;

  walletConnect = this._createProxyService(
    'walletConnect',
  ) as WalletConnectAdapter;

  servicePromise = this._createProxyService('servicePromise') as ServicePromise;

  serviceDapp = this._createProxyService('serviceDapp') as ServiceDapp;

  serviceAccount = this._createProxyService('serviceAccount') as ServiceAccount;

  serviceNetwork = this._createProxyService('serviceNetwork') as ServiceNetwork;

  serviceApp = this._createProxyService('serviceApp') as ServiceApp;

  serviceCronJob = this._createProxyService('serviceCronJob') as ServiceCronJob;

  serviceOnboarding = this._createProxyService(
    'serviceOnboarding',
  ) as ServiceOnboarding;

  _createProxyService(name = 'ROOT') {
    const NOOP = new Proxy(
      {},
      {
        get: (target, prop) => {
          if (typeof prop === 'string') {
            const key = `${name}.${prop}`;
            if (!this._proxyServiceCache[key]) {
              this._proxyServiceCache[key] = (...args: any) => {
                debugLogger.backgroundApi('Proxy method call', key, ...args);
                return this.callBackground(key, ...args);
              };
            }
            return this._proxyServiceCache[key];
          }
          return (target as any)[prop];
        },
      },
    );
    return NOOP;
  }

  // ----------------------------------------------

  listNetworks(...args: any) {
    return this.callBackground('listNetworks', ...args);
  }
}

export default BackgroundApiProxy;
