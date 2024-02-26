/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line import/order

import simpleDb from '../dbs/simple/simpleDb';
import { vaultFactory } from '../vaults/factory';

import BackgroundApiBase from './BackgroundApiBase';

import type { IBackgroundApi } from './IBackgroundApi';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  constructor() {
    super();
    vaultFactory.setBackgroundApi(this);
    void this.serviceBootstrap.init();
  }

  simpleDb = simpleDb;
  // validator = this.engine.validator;

  // vaultFactory = this.engine.vaultFactory;

  get walletConnect() {
    const ProviderApiWalletConnect =
      require('../providers/ProviderApiWalletConnect/ProviderApiWalletConnect') as typeof import('../providers/ProviderApiWalletConnect/ProviderApiWalletConnect');
    const value = new ProviderApiWalletConnect.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'walletConnect', { value });
    return value;
  }

  get servicePromise() {
    const Service =
      require('../services/ServicePromise') as typeof import('../services/ServicePromise');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePromise', { value });
    return value;
  }

  get serviceApp() {
    const Service =
      require('../services/ServiceApp') as typeof import('../services/ServiceApp');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceApp', { value });
    return value;
  }

  get servicePassword() {
    const Service =
      require('../services/ServicePassword') as typeof import('../services/ServicePassword');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePassword', { value });
    return value;
  }

  get serviceNetwork() {
    const Service =
      require('../services/ServiceNetwork') as typeof import('../services/ServiceNetwork');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNetwork', { value });
    return value;
  }

  get serviceAccount() {
    const Service =
      require('../services/ServiceAccount') as typeof import('../services/ServiceAccount');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAccount', { value });
    return value;
  }

  get serviceDevSetting() {
    const Service =
      require('../services/ServiceDevSetting') as typeof import('../services/ServiceDevSetting');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDevSetting', { value });
    return value;
  }

  get serviceSetting() {
    const Service =
      require('../services/ServiceSetting') as typeof import('../services/ServiceSetting');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSetting', { value });
    return value;
  }

  get serviceSend() {
    const ServiceSend =
      require('../services/ServiceSend') as typeof import('../services/ServiceSend');
    const value = new ServiceSend.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSend', { value });
    return value;
  }

  get serviceSwap() {
    const ServiceSwap =
      require('../services/ServiceSwap') as typeof import('../services/ServiceSwap');
    const value = new ServiceSwap.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSwap', { value });
    return value;
  }

  get serviceBootstrap() {
    const Service =
      require('../services/ServiceBootstrap') as typeof import('../services/ServiceBootstrap');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceBootstrap', { value });
    return value;
  }

  get serviceToken() {
    const ServiceToken =
      require('../services/ServiceToken') as typeof import('../services/ServiceToken');
    const value = new ServiceToken.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceToken', { value });
    return value;
  }

  get serviceNFT() {
    const ServiceNFT =
      require('../services/ServiceNFT') as typeof import('../services/ServiceNFT');
    const value = new ServiceNFT.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNFT', { value });
    return value;
  }

  get serviceHistory() {
    const ServiceHistory =
      require('../services/ServiceHistory') as typeof import('../services/ServiceHistory');
    const value = new ServiceHistory.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHistory', { value });
    return value;
  }

  get serviceDefi() {
    const ServiceDefi =
      require('../services/ServiceDefi') as typeof import('../services/ServiceDefi');
    const value = new ServiceDefi.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDefi', { value });
    return value;
  }

  get serviceScanQRCode() {
    const ServiceScanQRCode =
      require('../services/ServiceScanQRCode') as typeof import('../services/ServiceScanQRCode');
    const value = new ServiceScanQRCode.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceScanQRCode', { value });
    return value;
  }

  get serviceValidator() {
    const ServiceValidator =
      require('../services/ServiceValidator') as typeof import('../services/ServiceValidator');
    const value = new ServiceValidator.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceValidator', { value });
    return value;
  }

  get serviceNameResolver() {
    const ServiceNameResolver =
      require('../services/ServiceNameResolver') as typeof import('../services/ServiceNameResolver');
    const value = new ServiceNameResolver.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNameResolver', { value });
    return value;
  }

  get serviceGas() {
    const ServiceGas =
      require('../services/ServiceGas') as typeof import('../services/ServiceGas');
    const value = new ServiceGas.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceGas', { value });
    return value;
  }

  get serviceDiscovery() {
    const ServiceDiscovery =
      require('../services/ServiceDiscovery') as typeof import('../services/ServiceDiscovery');
    const value = new ServiceDiscovery.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDiscovery', { value });
    return value;
  }

  get serviceDApp() {
    const ServiceDApp =
      require('../services/ServiceDApp') as typeof import('../services/ServiceDApp');
    const value = new ServiceDApp.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDApp', { value });
    return value;
  }

  get serviceAccountProfile() {
    const ServiceAccountProfile =
      require('../services/ServiceAccountProfile') as typeof import('../services/ServiceAccountProfile');
    const value = new ServiceAccountProfile.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAccountProfile', { value });
    return value;
  }

  get serviceHardware() {
    const ServiceHardware =
      require('../services/ServiceHardware') as typeof import('../services/ServiceHardware');
    const value = new ServiceHardware.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHardware', { value });
    return value;
  }

  get serviceOnboarding() {
    const Service =
      require('../services/ServiceOnboarding') as typeof import('../services/ServiceOnboarding');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceOnboarding', { value });
    return value;
  }

  get serviceAddressBook() {
    const ServiceAddressBook =
      require('../services/ServiceAddressBook') as typeof import('../services/ServiceAddressBook');
    const value = new ServiceAddressBook.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAddressBook', { value });
    return value;
  }
}
export default BackgroundApi;
