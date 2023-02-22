import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { formatServerToken } from '@onekeyhq/engine/src/managers/token';
import type { ServerToken } from '@onekeyhq/engine/src/types/token';
import type { FiatPayModeType } from '@onekeyhq/kit/src/views/FiatPay/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceFiatPay extends ServiceBase {
  get baseUrl() {
    return `${getFiatEndpoint()}/moonpay`;
  }

  @backgroundMethod()
  async getFiatPayUrl(param: {
    type: FiatPayModeType;
    address?: string;
    networkId?: string;
    tokenAddress?: string;
  }) {
    const { appSelector } = this.backgroundApi;
    const testMode =
      appSelector((s) => s?.settings?.devMode?.onRamperTestMode ?? false) ??
      false;
    const urlParams = new URLSearchParams({
      ...param,
      mode: testMode ? 'test' : 'live',
    });
    const apiUrl = `${this.baseUrl}/url?${urlParams.toString()}`;
    const url = await this.client
      .get<string>(apiUrl)
      .then((resp) => resp.data)
      .catch(() => '');
    return url;
  }

  @backgroundMethod()
  async getFiatPayList(param: { type: FiatPayModeType; networkId?: string }) {
    const urlParams = new URLSearchParams({
      ...param,
    });
    const apiUrl = `${this.baseUrl}/list?${urlParams.toString()}`;
    const data = await this.client
      .get<ServerToken[]>(apiUrl)
      .then((resp) => resp.data)
      .catch(() => [] as ServerToken[]);
    return data.map((t) => formatServerToken(t));
  }
}

export default ServiceFiatPay;
