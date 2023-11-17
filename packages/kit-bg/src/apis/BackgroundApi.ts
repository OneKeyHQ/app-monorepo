/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line import/order

import BackgroundApiBase from './BackgroundApiBase';

import type { IBackgroundApi } from './IBackgroundApi';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  // validator = this.engine.validator;

  // vaultFactory = this.engine.vaultFactory;

  get servicePromise() {
    const ServicePromise =
      require('../services/ServicePromise') as typeof import('../services/ServicePromise');
    const value = new ServicePromise.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePromise', { value });
    return value;
  }

  get serviceApp() {
    const ServicePromise =
      require('../services/ServiceApp') as typeof import('../services/ServiceApp');
    const value = new ServicePromise.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceApp', { value });
    return value;
  }

  get servicePassword() {
    const ServicePassword =
      require('../services/ServicePassword') as typeof import('../services/ServicePassword');
    const value = new ServicePassword.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePassword', { value });
    return value;
  }

  get serviceSetting() {
    const ServiceSetting =
      require('../services/ServiceSetting') as typeof import('../services/ServiceSetting');
    const value = new ServiceSetting.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSetting', { value });
    return value;
  }

  get serviceSend() {
    const ServicePromise =
      require('../services/ServiceSend') as typeof import('../services/ServiceSend');
    const value = new ServicePromise.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSend', { value });
    return value;
  }

  // get serviceBootstrap() {
  //   const ServiceBootstrap =
  //     require('../services/ServiceBootstrap') as typeof import('./services/ServiceBootstrap');
  //   const value = new ServiceBootstrap.default({
  //     backgroundApi: this,
  //   });
  //   Object.defineProperty(this, 'serviceBootstrap', { value });
  //   return value;
  // }
}
export default BackgroundApi;
