import { setBoardingCompleted } from '@onekeyhq/kit/src/store/reducers/status';
import { selectBoardingCompleted } from '@onekeyhq/kit/src/store/selectors';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceOnboarding extends ServiceBase {
  @backgroundMethod()
  async checkOnboardingStatus() {
    const { engine, dispatch, appSelector } = this.backgroundApi;
    const boardingCompleted = appSelector(selectBoardingCompleted);
    if (boardingCompleted) {
      return;
    }
    const wallets = await engine.getWallets();
    for (let i = 0; i < wallets.length; i += 1) {
      const wallet = wallets[i];
      if (wallet.accounts.length > 0) {
        dispatch(setBoardingCompleted());
        break;
      }
    }
  }
}
