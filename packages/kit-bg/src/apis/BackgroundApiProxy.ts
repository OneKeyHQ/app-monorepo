/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type ServiceApp from '../services/ServiceApp';
// import type ServiceBootstrap from './services/ServiceBootstrap';
// import type ServiceCronJob from './services/ServiceCronJob';
import type ServicePromise from '../services/ServicePromise';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  _serviceCreatedNames = {} as any;

  _proxyServiceCache = {} as any;

  servicePromise = this._createProxyService('servicePromise') as ServicePromise;

  serviceApp = this._createProxyService('serviceApp') as ServiceApp;

  // serviceCronJob = this._createProxyService('serviceCronJob') as ServiceCronJob;

  // serviceBootstrap = this._createProxyService(
  //   'serviceBootstrap',
  // ) as ServiceBootstrap;

  _createProxyService(name = 'ROOT') {
    if (this._serviceCreatedNames[name]) {
      throw new Error(`_createProxyService name duplicated. name=${name}`);
    }
    this._serviceCreatedNames[name] = true;
    const NOOP = new Proxy(
      {},
      {
        get: (target, prop) => {
          if (typeof prop === 'string') {
            const key = `${name}.${prop}`;
            if (!this._proxyServiceCache[key]) {
              this._proxyServiceCache[key] = (...args: any) => {
                if (!['serviceApp.addLogger'].includes(key)) {
                  // debugLogger.backgroundApi.info('Proxy method call', key);
                }
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
}

export default BackgroundApiProxy;
