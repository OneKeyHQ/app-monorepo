import axios from 'axios';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import type { FiatPayModeType } from '@onekeyhq/kit/src/views/FiatPay/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class FiatPayNFT extends ServiceBase {
  private client = axios.create({ timeout: 60 * 1000 });

  get baseUrl() {
    return `${getFiatEndpoint()}/moonpay`;
  }

  @backgroundMethod()
  async getFiatPayUrl(param: {
    type: FiatPayModeType;
    cryptoCode?: string;
    address?: string;
  }) {
    const { appSelector } = this.backgroundApi;
    const onRamperTestMode =
      appSelector((s) => s?.settings?.devMode?.onRamperTestMode ?? false) ??
      false;
    const urlParams = new URLSearchParams({
      ...param,
      mode: onRamperTestMode ? 'test' : 'live',
    });
    const apiUrl = `${this.baseUrl}/url?${urlParams.toString()}`;
    const url = await this.client
      .get<string>(apiUrl)
      .then((resp) => resp.data)
      .catch(() => '');
    return url;
  }
}

export default FiatPayNFT;
