import { runtimeUnlock } from '../../store/reducers/general';
import { updateNetworkMap } from '../../store/reducers/network';
import {
  setBoardingCompleted,
  setPasswordCompleted,
  unlock,
} from '../../store/reducers/status';
import { updateWallets } from '../../store/reducers/wallet';
import { backgroundClass, backgroundMethod } from '../decorators';
import { delay } from '../utils';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  @backgroundMethod()
  async resetApp() {
    const { engine, dispatch, persistor } = this.backgroundApi;
    await persistor.purge();
    await engine.resetApp();
    dispatch({ type: 'LOGOUT', payload: undefined });
    await delay(300);
    await this.initNetworks();
  }

  @backgroundMethod()
  async initNetworks() {
    const { engine, dispatch } = this.backgroundApi;
    let networksFromBE = await engine.listNetworks(false);
    if (!networksFromBE.length) {
      // listNetworks() will return empty after resetApp()
      //    so we should call syncPresetNetworks() here
      await engine.syncPresetNetworks();
      networksFromBE = await engine.listNetworks();
    }
    dispatch(updateNetworkMap(networksFromBE));
    return networksFromBE;
  }

  @backgroundMethod()
  async createHDWallet({ password }: { password: string }) {
    const { dispatch, engine, serviceAccount } = this.backgroundApi;
    const wallet = await engine.createHDWallet(password);
    const walletsFromBE = await engine.getWallets();
    dispatch(updateWallets(walletsFromBE));
    dispatch(setBoardingCompleted());
    dispatch(setPasswordCompleted());
    dispatch(unlock());
    dispatch(runtimeUnlock());
    serviceAccount.changeActiveAccount({
      account: null,
      wallet,
    });
  }
}

export default ServiceApp;
