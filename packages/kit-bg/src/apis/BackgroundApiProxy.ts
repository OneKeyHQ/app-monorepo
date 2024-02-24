/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import { SimpleDbProxy } from '../dbs/simple/base/SimpleDbProxy';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type { ProviderApiWalletConnect } from '../providers/ProviderApiWalletConnect';
import type ServiceAccount from '../services/ServiceAccount';
import type ServiceAccountProfile from '../services/ServiceAccountProfile';
import type ServiceAddressBook from '../services/ServiceAddressBook';
import type ServiceApp from '../services/ServiceApp';
import type ServiceBootstrap from '../services/ServiceBootstrap';
import type ServiceDApp from '../services/ServiceDApp';
import type ServiceDefi from '../services/ServiceDefi';
import type ServiceDevSetting from '../services/ServiceDevSetting';
import type ServiceDiscovery from '../services/ServiceDiscovery';
import type ServiceGas from '../services/ServiceGas';
import type ServiceHardware from '../services/ServiceHardware';
import type ServiceHistory from '../services/ServiceHistory';
import type ServiceNameResolver from '../services/ServiceNameResolver';
import type ServiceNetwork from '../services/ServiceNetwork';
import type ServiceNFT from '../services/ServiceNFT';
import type ServiceOnboarding from '../services/ServiceOnboarding';
import type ServicePassword from '../services/ServicePassword';
// import type ServiceCronJob from './services/ServiceCronJob';
import type ServicePromise from '../services/ServicePromise';
import type ServiceScanQRCode from '../services/ServiceScanQRCode';
import type ServiceSend from '../services/ServiceSend';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceToken from '../services/ServiceToken';
import type ServiceValidator from '../services/ServiceValidator';
import type ServiceWalletConnect from '../services/ServiceWalletConnect';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  simpleDb = new SimpleDbProxy(this);

  walletConnect = this._createProxyService(
    'walletConnect',
  ) as ProviderApiWalletConnect;

  servicePromise = this._createProxyService('servicePromise') as ServicePromise;

  servicePassword = this._createProxyService(
    'servicePassword',
  ) as ServicePassword;

  serviceDevSetting = this._createProxyService(
    'serviceDevSetting',
  ) as ServiceDevSetting;

  serviceSetting = this._createProxyService('serviceSetting') as ServiceSetting;

  serviceNetwork = this._createProxyService('serviceNetwork') as ServiceNetwork;

  serviceAccount = this._createProxyService('serviceAccount') as ServiceAccount;

  serviceApp = this._createProxyService('serviceApp') as ServiceApp;

  serviceSend = this._createProxyService('serviceSend') as ServiceSend;

  serviceToken = this._createProxyService('serviceToken') as ServiceToken;

  serviceNFT = this._createProxyService('serviceNFT') as ServiceNFT;

  serviceHistory = this._createProxyService('serviceHistory') as ServiceHistory;

  serviceDefi = this._createProxyService('serviceDefi') as ServiceDefi;

  serviceValidator = this._createProxyService(
    'serviceValidator',
  ) as ServiceValidator;

  serviceScanQRCode = this._createProxyService(
    'serviceScanQRCode',
  ) as ServiceScanQRCode;

  serviceNameResolver = this._createProxyService(
    'serviceNameResolver',
  ) as ServiceNameResolver;

  serviceGas = this._createProxyService('serviceGas') as ServiceGas;

  serviceDiscovery = this._createProxyService(
    'serviceDiscovery',
  ) as ServiceDiscovery;

  serviceDApp = this._createProxyService('serviceDApp') as ServiceDApp;

  serviceWalletConnect = this._createProxyService(
    'serviceWalletConnect',
  ) as ServiceWalletConnect;

  serviceAccountProfile = this._createProxyService(
    'serviceAccountProfile',
  ) as ServiceAccountProfile;

  serviceOnboarding = this._createProxyService(
    'serviceOnboarding',
  ) as ServiceOnboarding;

  // serviceCronJob = this._createProxyService('serviceCronJob') as ServiceCronJob;

  serviceBootstrap = this._createProxyService(
    'serviceBootstrap',
  ) as ServiceBootstrap;

  serviceHardware = this._createProxyService(
    'serviceHardware',
  ) as ServiceHardware;

  serviceAddressBook = this._createProxyService(
    'serviceAddressBook',
  ) as ServiceAddressBook;
}

export default BackgroundApiProxy;
