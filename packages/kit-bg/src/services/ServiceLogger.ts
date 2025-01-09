import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceLogger extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  maxLength = 1000;

  data: string[] = [];

  @backgroundMethod()
  async getAllMsg() {
    return Promise.resolve(this.data);
  }

  @backgroundMethod()
  async addMsg(message: string) {
    if (!platformEnv.isNative) {
      if (this.data.length >= this.maxLength) {
        this.data.shift();
      }
      this.data.push(message);
    }
    return Promise.resolve(true);
  }
}

export default ServiceLogger;
