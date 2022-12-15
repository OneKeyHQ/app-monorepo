import { updateFiatMoneyMap } from '@onekeyhq/kit/src/store/reducers/fiatMoney';
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
    const { engine, dispatch } = this.backgroundApi;
    const fiatMoney = await engine.listFiats();
    dispatch(updateFiatMoneyMap(fiatMoney));
  }

  // **** account/token balance polling
  //  packages/kit/src/views/Wallet/AccountInfo/index.tsx
  /*
  const { accountTokens, prices, balances, charts } = useManageTokens({
    pollingInterval: 15000,
  });
   */
}
