import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type ServiceAccount from '../../../../kit-bg/src/services/ServiceAccount';
import type ServiceAccountSelector from '../../../../kit-bg/src/services/ServiceAccountSelector';
import type ServiceApp from '../../../../kit-bg/src/services/ServiceApp';
import type ServiceBatchTransfer from '../../../../kit-bg/src/services/ServiceBatchTransfer';
import type ServiceBootstrap from '../../../../kit-bg/src/services/ServiceBootstrap';
import type ServiceCloudBackup from '../../../../kit-bg/src/services/ServiceCloudBackup';
import type ServiceCronJob from '../../../../kit-bg/src/services/ServiceCronJob';
import type ServiceDapp from '../../../../kit-bg/src/services/ServiceDapp';
import type ServiceDiscover from '../../../../kit-bg/src/services/ServiceDiscover';
import type ServiceExternalAccount from '../../../../kit-bg/src/services/ServiceExternalAccount';
import type ServiceHardware from '../../../../kit-bg/src/services/ServiceHardware';
import type ServiceHistory from '../../../../kit-bg/src/services/ServiceHistory';
import type ServiceMarket from '../../../../kit-bg/src/services/ServiceMarket';
import type ServiceNameResolver from '../../../../kit-bg/src/services/ServiceNameResolver';
import type ServiceNetwork from '../../../../kit-bg/src/services/ServiceNetwork';
import type ServiceNFT from '../../../../kit-bg/src/services/ServiceNFT';
import type ServiceNotification from '../../../../kit-bg/src/services/ServiceNotification';
import type ServiceOnboarding from '../../../../kit-bg/src/services/ServiceOnboarding';
import type ServicePassword from '../../../../kit-bg/src/services/ServicePassword';
import type ServicePromise from '../../../../kit-bg/src/services/ServicePromise';
import type ServiceRevoke from '../../../../kit-bg/src/services/ServiceRevoke';
import type ServiceSetting from '../../../../kit-bg/src/services/ServiceSetting';
import type ServiceSocket from '../../../../kit-bg/src/services/ServiceSocket';
import type ServiceStaking from '../../../../kit-bg/src/services/ServiceStaking';
import type ServiceSwap from '../../../../kit-bg/src/services/ServiceSwap';
import type ServiceToken from '../../../../kit-bg/src/services/ServiceToken';
import type ServiceTransaction from '../../../../kit-bg/src/services/ServiceTransaction';
import type ServiceWalletConnect from '../../../../kit-bg/src/services/ServiceWalletConnect';

// import BackgroundApiProxy from '../BackgroundApiProxy';

class BackgroundApiProxy {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: any;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
