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
    const Service =
      require('../services/ServiceSend') as typeof import('../services/ServiceSend');
    const value = new Service.default({
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
}
export default BackgroundApi;
