/* eslint-disable @typescript-eslint/require-await */
import axios from 'axios';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';

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
    // const url = getFiatEndpoint();
    const url = 'http://localhost:9000';
    return `${url}/translations`;
  }

  @backgroundMethod()
  async getAll() {
    const url = `${this.baseUrl}/all`;
    const res = await this.client.get(url)
    return res.data as Record<string, Record<string, string>>
  }
}

export default ServicTranslation;
