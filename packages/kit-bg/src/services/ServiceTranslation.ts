/* eslint-disable @typescript-eslint/require-await */
import axios from 'axios';

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

  get client() {
    return axios.create({ timeout: 60 * 30 * 1000 });
  }

  get baseUrl() {
    const url = getFiatEndpoint();
    // const url = 'http://localhost:9000';
    return `${url}/translations`;
  }

  @backgroundMethod()
  async getTranslations() {
    const url = `${this.baseUrl}/all`;
    const res = await this.client.get(url);
    const data = res.data as Record<string, Record<string, string>>;
    this.backgroundApi.dispatch(setTranslations(data));
  }
}

export default ServicTranslation;
