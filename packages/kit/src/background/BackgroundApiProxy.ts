/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import type { Engine } from '@onekeyhq/engine';
import type { Validators } from '@onekeyhq/engine/src/validators';
import type { VaultFactory } from '@onekeyhq/engine/src/vaults/VaultFactory';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';
import ServicePassword from './services/ServicePassword';

import type { IBackgroundApi } from './IBackgroundApi';
import type ProviderApiWalletConnect from './providers/ProviderApiWalletConnect';
import type ServiceAccount from './services/ServiceAccount';
import type ServiceAccountSelector from './services/ServiceAccountSelector';
import type ServiceApp from './services/ServiceApp';
import type ServiceCloudBackup from './services/ServiceCloudBackup';
import type ServiceCronJob from './services/ServiceCronJob';
import type ServiceDapp from './services/ServiceDapp';
import type ServiceHardware from './services/ServiceHardware';
import type ServiceHistory from './services/ServiceHistory';
import type ServiceNetwork from './services/ServiceNetwork';
import type ServiceOnboarding from './services/ServiceOnboarding';
import type ServicePromise from './services/ServicePromise';
import type ServiceStaking from './services/ServiceStaking';
import type ServiceSwap from './services/ServiceSwap';
import type ServiceToken from './services/ServiceToken';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  _serviceCreatedNames = {} as any;

  _proxyServiceCache = {} as any;

  engine = this._createProxyService('engine') as Engine;

  validator = this._createProxyService('validator') as Validators;

  // TODO remove or add wrong calling check like MM's shimweb3
  vaultFactory = {} as VaultFactory;

  walletConnect = this._createProxyService(
    'walletConnect',
  ) as ProviderApiWalletConnect;

  servicePromise = this._createProxyService('servicePromise') as ServicePromise;

  serviceDapp = this._createProxyService('serviceDapp') as ServiceDapp;

  serviceAccountSelector = this._createProxyService(
    'serviceAccountSelector',
  ) as ServiceAccountSelector;

  serviceAccount = this._createProxyService('serviceAccount') as ServiceAccount;

  serviceNetwork = this._createProxyService('serviceNetwork') as ServiceNetwork;

  serviceApp = this._createProxyService('serviceApp') as ServiceApp;

  serviceCronJob = this._createProxyService('serviceCronJob') as ServiceCronJob;

  serviceOnboarding = this._createProxyService(
    'serviceOnboarding',
  ) as ServiceOnboarding;

  serviceToken = this._createProxyService('serviceToken') as ServiceToken;

  serviceHistory = this._createProxyService('serviceHistory') as ServiceHistory;

  serviceHardware = this._createProxyService(
    'serviceHardware',
  ) as ServiceHardware;

  servicePassword = this._createProxyService(
    'servicePassword',
  ) as ServicePassword;

  serviceSwap = this._createProxyService('serviceSwap') as ServiceSwap;

  serviceCloudBackup = this._createProxyService(
    'serviceCloudBackup',
  ) as ServiceCloudBackup;

  serviceStaking = this._createProxyService('serviceStaking') as ServiceStaking;

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
                  debugLogger.backgroundApi.info('Proxy method call', key);
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
