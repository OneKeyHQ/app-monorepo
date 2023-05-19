/* eslint-disable @typescript-eslint/require-await */

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { setTranslations } from '@onekeyhq/kit/src/store/reducers/data';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServicTranslation extends ServiceBase {
  updatedAt = 0;

  get baseUrl() {
    const url = getFiatEndpoint();
    return `${url}/translations`;
  }

  @backgroundMethod()
  async getTranslations() {
    const url = `${this.baseUrl}/all`;
    const res = await this.client.get(url);
    const data = res.data as Record<string, Record<string, string>>;
    this.backgroundApi.dispatch(setTranslations(data));
  }

  @backgroundMethod()
  async fetchData() {
    if (Date.now() - this.updatedAt > 60 * 60 * 1000) {
      await this.getTranslations();
      this.updatedAt = Date.now();
    }
  }
}

export default ServicTranslation;
