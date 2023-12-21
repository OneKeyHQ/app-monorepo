import { backgroundClass } from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceBootstrap extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  public async init() {
    await Promise.all([
      this.backgroundApi.serviceSetting.refreshLocaleMessages(),
    ]);
  }
}

export default ServiceBootstrap;
