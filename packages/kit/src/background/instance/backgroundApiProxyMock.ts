import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type ServiceAccount from '../services/ServiceAccount';
import type ServiceAccountSelector from '../services/ServiceAccountSelector';
import type ServiceApp from '../services/ServiceApp';
import type ServiceBatchTransfer from '../services/ServiceBatchTransfer';
import type ServiceBootstrap from '../services/ServiceBootstrap';
import type ServiceCloudBackup from '../services/ServiceCloudBackup';
import type ServiceCronJob from '../services/ServiceCronJob';
import type ServiceDapp from '../services/ServiceDapp';
import type ServiceDiscover from '../services/ServiceDiscover';
import type ServiceExternalAccount from '../services/ServiceExternalAccount';
import type ServiceHardware from '../services/ServiceHardware';
import type ServiceHistory from '../services/ServiceHistory';
import type ServiceMarket from '../services/ServiceMarket';
import type ServiceNameResolver from '../services/ServiceNameResolver';
import type ServiceNetwork from '../services/ServiceNetwork';
import type ServiceNFT from '../services/ServiceNFT';
import type ServiceNotification from '../services/ServiceNotification';
import type ServiceOnboarding from '../services/ServiceOnboarding';
import type ServicePassword from '../services/ServicePassword';
import type ServicePromise from '../services/ServicePromise';
import type ServiceRevoke from '../services/ServiceRevoke';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceSocket from '../services/ServiceSocket';
import type ServiceStaking from '../services/ServiceStaking';
import type ServiceSwap from '../services/ServiceSwap';
import type ServiceToken from '../services/ServiceToken';
import type ServiceTransaction from '../services/ServiceTransaction';
import type ServiceWalletConnect from '../services/ServiceWalletConnect';

// import BackgroundApiProxy from '../BackgroundApiProxy';

class BackgroundApiProxy {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: any;

  _createProxyService(name: string) {
    return {};
  }

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
}

// import backgroundApiInit from './backgroundApiInit';

const backgroundApi = null;

if (!platformEnv.isExtensionUi) {
  // backgroundApi = backgroundApiInit();
}
const backgroundApiProxy = new BackgroundApiProxy({
  backgroundApi,
});

global.$backgroundApiProxy = backgroundApiProxy as any;

export default backgroundApiProxy;
