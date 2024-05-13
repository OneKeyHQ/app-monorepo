import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { ONEKEY_APP_UPDATE_URL } from '@onekeyhq/shared/src/config/appConfig';

import ServiceBase from './ServiceBase';

const AxiosInstance = axios.create();

@backgroundClass()
class ServiceMarket extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getEndpoints() {
    const url = ONEKEY_APP_UPDATE_URL;
    const key = Math.random().toString();
    return `${url}?&nocache=${key}`;
  }

  @backgroundMethod()
  async fetchConfig() {
    const url = await this.getEndpoints();
    const response = await AxiosInstance.get<unknown>(url);
    console.log('---response.data---', response.data);
    return response.data;
  }
}

export default ServiceMarket;
