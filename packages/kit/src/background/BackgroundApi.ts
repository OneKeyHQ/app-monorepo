import { Engine } from '@onekeyhq/engine';

import BackgroundApiBase from './BackgroundApiBase';
import { backgroundMethod } from './decorators';
import { IBackgroundApi } from './IBackgroundApi';
import WalletConnectAdapter from './providers/WalletConnectAdapter';
import ServiceAccount from './services/ServiceAccount';
import ServiceApp from './services/ServiceApp';
import ServiceCronJob from './services/ServiceCronJob';
import ServiceDapp from './services/ServiceDapp';
import ServiceNetwork from './services/ServiceNetwork';
import ServiceOnboarding from './services/ServiceOnboarding';
import ServicePromise from './services/ServicePromise';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  engine = new Engine();

  validator = this.engine.validator;

  walletConnect = new WalletConnectAdapter({
    backgroundApi: this,
  });

  servicePromise = new ServicePromise({
    backgroundApi: this,
  });

  serviceDapp = new ServiceDapp({
    backgroundApi: this,
  });

  serviceAccount = new ServiceAccount({
    backgroundApi: this,
  });

  serviceNetwork = new ServiceNetwork({
    backgroundApi: this,
  });

  serviceApp = new ServiceApp({
    backgroundApi: this,
  });

  serviceCronJob = new ServiceCronJob({
    backgroundApi: this,
  });

  serviceOnboarding = new ServiceOnboarding({
    backgroundApi: this,
  });

  // ----------------------------------------------

  @backgroundMethod()
  listNetworks(...params: any) {
    return this.engine.listNetworks(...params);
  }
}
export default BackgroundApi;
