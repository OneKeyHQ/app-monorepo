import { Engine } from '@onekeyhq/engine';

import BackgroundApiBase from './BackgroundApiBase';
import { IBackgroundApi } from './IBackgroundApi';
import WalletConnectAdapter from './providers/WalletConnectAdapter';
import ServiceAccount from './services/ServiceAccount';
import ServiceApp from './services/ServiceApp';
import ServiceCronJob from './services/ServiceCronJob';
import ServiceDapp from './services/ServiceDapp';
import ServiceHistory from './services/ServiceHistory';
import ServiceNetwork from './services/ServiceNetwork';
import ServiceOnboarding from './services/ServiceOnboarding';
import ServicePromise from './services/ServicePromise';
import ServiceToken from './services/ServiceToken';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  engine = new Engine();

  validator = this.engine.validator;

  vaultFactory = this.engine.vaultFactory;

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

  serviceToken = new ServiceToken({
    backgroundApi: this,
  });

  serviceHistory = new ServiceHistory({
    backgroundApi: this,
  });
}
export default BackgroundApi;
