import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { updateFiatMoneyMap } from '@onekeyhq/kit/src/store/reducers/fiatMoney';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

@backgroundClass()
export default class ServiceCronJob extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    if (platformEnv.isExtensionBackground) {
      setInterval(() => this.checkHideSpecialWallet(), 60 * 1000);
    }
  }

  // TODO: make interval internal
  @backgroundMethod()
  async getFiatMoney() {
    const { engine, dispatch } = this.backgroundApi;
    const fiatMoney = await engine.listFiats();
    dispatch(updateFiatMoneyMap(fiatMoney));
  }

  @backgroundMethod()
  async checkHideSpecialWallet() {
    const { engine, serviceAccount } = this.backgroundApi;
    const lastActivity = await simpleDb.lastActivity.getValue();

    const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
    // Lock the screen for two hours, hide the special wallet
    const hide = idleDuration >= 2 * 60;

    if (hide) {
      const hideSize = await engine.hideSpecialWallet();
      if (!platformEnv.isExtensionBackground && hideSize) {
        serviceAccount.initWallets();
      }
    }
  }
}
