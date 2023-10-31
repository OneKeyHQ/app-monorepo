/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line import/order

import BackgroundApiBase from './BackgroundApiBase';

import type { IBackgroundApi } from './IBackgroundApi';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  constructor() {
    super();
  }
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
