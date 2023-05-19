import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceCronJob extends ServiceBase {
  // **** fiat price polling
  //  packages/kit/src/provider/AppLoading.tsx
  // TODO: make interval internal
  @backgroundMethod()
  async getFiatMoney() {
    const { engine, servicePrice } = this.backgroundApi;
    const fiatMoney = await engine.listFiats();
    return servicePrice.updateFiatMoneyMap(fiatMoney);
  }
}
