import { updateFiatMoneyMap } from '@onekeyhq/kit/src/store/reducers/fiatMoney';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceCronJob extends ServiceBase {
  // TODO: make interval internal
  @backgroundMethod()
  async getFiatMoney() {
    const { engine, dispatch } = this.backgroundApi;
    const fiatMoney = await engine.listFiats();
    dispatch(updateFiatMoneyMap(fiatMoney));
  }
}
