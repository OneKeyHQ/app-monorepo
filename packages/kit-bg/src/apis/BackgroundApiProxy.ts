/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import { SimpleDbProxy } from '../dbs/simple/base/SimpleDbProxy';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type ServiceAccount from '../services/ServiceAccount';
import type ServiceApp from '../services/ServiceApp';
import type ServiceBootstrap from '../services/ServiceBootstrap';
import type ServiceDefi from '../services/ServiceDefi';
import type ServiceDiscovery from '../services/ServiceDiscovery';
import type ServiceGas from '../services/ServiceGas';
import type ServiceHardware from '../services/ServiceHardware';
import type ServiceHistory from '../services/ServiceHistory';
import type ServiceNameResolver from '../services/ServiceNameResolver';
import type ServiceNFT from '../services/ServiceNFT';
import type ServicePassword from '../services/ServicePassword';
// import type ServiceCronJob from './services/ServiceCronJob';
import type ServicePromise from '../services/ServicePromise';
import type ServiceSend from '../services/ServiceSend';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceSwap from '../services/ServiceSwap';
import type ServiceToken from '../services/ServiceToken';
import type ServiceValidator from '../services/ServiceValidator';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  simpleDb = new SimpleDbProxy(this);

  servicePromise = this._createProxyService('servicePromise') as ServicePromise;

  servicePassword = this._createProxyService(
    'servicePassword',
  ) as ServicePassword;

  serviceSetting = this._createProxyService('serviceSetting') as ServiceSetting;

  serviceAccount = this._createProxyService('serviceAccount') as ServiceAccount;

  serviceApp = this._createProxyService('serviceApp') as ServiceApp;

  serviceDiscovery = this._createProxyService(
    'serviceDiscovery',
  ) as ServiceDiscovery;

  serviceSend = this._createProxyService('serviceSend') as ServiceSend;

  serviceSwap = this._createProxyService('serviceSwap') as ServiceSwap;

  serviceToken = this._createProxyService('serviceToken') as ServiceToken;

  serviceNFT = this._createProxyService('serviceNFT') as ServiceNFT;

  serviceHistory = this._createProxyService('serviceHistory') as ServiceHistory;

  serviceDefi = this._createProxyService('serviceDefi') as ServiceDefi;

  serviceValidator = this._createProxyService(
    'serviceValidator',
  ) as ServiceValidator;

  serviceNameResolver = this._createProxyService(
    'serviceNameResolver',
  ) as ServiceNameResolver;

  serviceGas = this._createProxyService('serviceGas') as ServiceGas;

  // serviceCronJob = this._createProxyService('serviceCronJob') as ServiceCronJob;

  serviceBootstrap = this._createProxyService(
    'serviceBootstrap',
  ) as ServiceBootstrap;

  serviceHardware = this._createProxyService(
    'serviceHardware',
  ) as ServiceHardware;
}

export default BackgroundApiProxy;
