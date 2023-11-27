/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import type { Engine } from '@onekeyhq/engine';
import type { Validators } from '@onekeyhq/engine/src/validators';
import type { VaultFactory } from '@onekeyhq/engine/src/vaults/VaultFactory';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type { ProviderApiWalletConnect } from './providers/ProviderApiWalletConnect';
import type ServiceAccount from './services/ServiceAccount';
import type ServiceAccountSelector from './services/ServiceAccountSelector';
import type ServiceAddressbook from './services/ServiceAddressbook';
import type ServiceAllNetwork from './services/ServiceAllNetwork';
import type ServiceApp from './services/ServiceApp';
import type ServiceBatchTransfer from './services/ServiceBatchTransfer';
import type ServiceBootstrap from './services/ServiceBootstrap';
import type ServiceBRC20 from './services/ServiceBRC20';
import type ServiceCloudBackup from './services/ServiceCloudBackup';
import type ServiceContract from './services/ServiceContract';
import type ServiceCronJob from './services/ServiceCronJob';
import type ServiceDapp from './services/ServiceDapp';
import type ServiceDappMetaData from './services/ServiceDappMetaData';
import type ServiceDerivationPath from './services/ServiceDerivationPath';
import type ServiceDiscover from './services/ServiceDiscover';
import type ServiceExternalAccount from './services/ServiceExternalAccount';
import type ServiceFiatPay from './services/ServiceFiatPay';
import type ServiceGas from './services/ServiceGas';
import type ServiceHardware from './services/ServiceHardware';
import type ServiceHistory from './services/ServiceHistory';
import type ServiceHTTP from './services/ServiceHTTP';
import type ServiceInscribe from './services/ServiceInscribe';
import type ServiceLightningNetwork from './services/ServiceLightningNetwork';
import type ServiceLimitOrder from './services/ServiceLimitOrder';
import type ServiceMarket from './services/ServiceMarket';
import type ServiceMigrate from './services/ServiceMigrate';
import type ServiceNameResolver from './services/ServiceNameResolver';
import type ServiceNetwork from './services/ServiceNetwork';
import type ServiceNFT from './services/ServiceNFT';
import type ServiceNostr from './services/ServiceNostr';
import type ServiceNotification from './services/ServiceNotification';
import type ServiceOnboarding from './services/ServiceOnboarding';
import type ServiceOverview from './services/ServiceOverview';
import type ServicePassword from './services/ServicePassword';
import type ServicePrice from './services/ServicePrice';
import type ServicePromise from './services/ServicePromise';
import type ServiceRevoke from './services/ServiceRevoke';
import type ServiceSetting from './services/ServiceSetting';
import type ServiceSocket from './services/ServiceSocket';
import type ServiceStaking from './services/ServiceStaking';
import type ServiceSwap from './services/ServiceSwap';
import type ServiceToken from './services/ServiceToken';
import type ServiceTransaction from './services/ServiceTransaction';
import type ServiceUtxos from './services/ServiceUtxos';
import type ServiceWalletConnect from './services/ServiceWalletConnect';

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

  serviceExternalAccount = this._createProxyService(
    'serviceExternalAccount',
  ) as ServiceExternalAccount;

  serviceNetwork = this._createProxyService('serviceNetwork') as ServiceNetwork;

  serviceApp = this._createProxyService('serviceApp') as ServiceApp;

  serviceCronJob = this._createProxyService('serviceCronJob') as ServiceCronJob;

  serviceOnboarding = this._createProxyService(
    'serviceOnboarding',
  ) as ServiceOnboarding;

  serviceToken = this._createProxyService('serviceToken') as ServiceToken;

  serviceWalletConnect = this._createProxyService(
    'serviceWalletConnect',
  ) as ServiceWalletConnect;

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

  serviceNameResolver = this._createProxyService(
    'serviceNameResolver',
  ) as ServiceNameResolver;

  serviceNFT = this._createProxyService('serviceNFT') as ServiceNFT;

  serviceNotification = this._createProxyService(
    'serviceNotification',
  ) as ServiceNotification;

  serviceSocket = this._createProxyService('serviceSocket') as ServiceSocket;

  serviceBootstrap = this._createProxyService(
    'serviceBootstrap',
  ) as ServiceBootstrap;

  serviceDiscover = this._createProxyService(
    'serviceDiscover',
  ) as ServiceDiscover;

  serviceMarket = this._createProxyService('serviceMarket') as ServiceMarket;

  serviceRevoke = this._createProxyService('serviceRevoke') as ServiceRevoke;

  serviceSetting = this._createProxyService('serviceSetting') as ServiceSetting;

  serviceBatchTransfer = this._createProxyService(
    'serviceBatchTransfer',
  ) as ServiceBatchTransfer;

  serviceTransaction = this._createProxyService(
    'serviceTransaction',
  ) as ServiceTransaction;

  servicePrice = this._createProxyService('servicePrice') as ServicePrice;

  serviceOverview = this._createProxyService(
    'serviceOverview',
  ) as ServiceOverview;

  serviceMigrate = this._createProxyService('serviceMigrate') as ServiceMigrate;

  serviceHTTP = this._createProxyService('serviceHTTP') as ServiceHTTP;

  serviceDerivationPath = this._createProxyService(
    'serviceDerivationPath',
  ) as ServiceDerivationPath;

  serviceFiatPay = this._createProxyService('serviceFiatPay') as ServiceFiatPay;

  serviceAddressbook = this._createProxyService(
    'serviceAddressbook',
  ) as ServiceAddressbook;

  serviceLimitOrder = this._createProxyService(
    'serviceLimitOrder',
  ) as ServiceLimitOrder;

  serviceUtxos = this._createProxyService('serviceUtxos') as ServiceUtxos;

  serviceInscribe = this._createProxyService(
    'serviceInscribe',
  ) as ServiceInscribe;

  serviceContract = this._createProxyService(
    'serviceContract',
  ) as ServiceContract;

  serviceLightningNetwork = this._createProxyService(
    'serviceLightningNetwork',
  ) as ServiceLightningNetwork;

  serviceGas = this._createProxyService('serviceGas') as ServiceGas;

  serviceAllNetwork = this._createProxyService(
    'serviceAllNetwork',
  ) as ServiceAllNetwork;

  serviceDappMetaData = this._createProxyService(
    'serviceDappMetaData',
  ) as ServiceDappMetaData;

  serviceBRC20 = this._createProxyService('serviceBRC20') as ServiceBRC20;

  serviceNostr = this._createProxyService('serviceNostr') as ServiceNostr;

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
