/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line import/order

import simpleDb from '../dbs/simple/simpleDb';

import BackgroundApiBase from './BackgroundApiBase';

import type { IBackgroundApi } from './IBackgroundApi';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  constructor() {
    super();
    void this.serviceBootstrap.init();
  }

  simpleDb = simpleDb;
  // validator = this.engine.validator;

  // vaultFactory = this.engine.vaultFactory;

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

  get serviceDiscovery() {
    const ServiceDiscovery =
      require('../services/ServiceDiscovery') as typeof import('../services/ServiceDiscovery');
    const value = new ServiceDiscovery.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDiscovery', { value });
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
}
export default BackgroundApi;
