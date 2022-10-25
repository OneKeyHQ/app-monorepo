import { Engine } from '@onekeyhq/engine';

import BackgroundApiBase from './BackgroundApiBase';
import { IBackgroundApi } from './IBackgroundApi';
import ProviderApiWalletConnect from './providers/ProviderApiWalletConnect';
import ServiceAccount from './services/ServiceAccount';
import ServiceAccountSelector from './services/ServiceAccountSelector';
import ServiceApp from './services/ServiceApp';
import ServiceBootstrap from './services/ServiceBootstrap';
import ServiceCloudBackup from './services/ServiceCloudBackup';
import ServiceCronJob from './services/ServiceCronJob';
import ServiceDapp from './services/ServiceDapp';
import ServiceDiscover from './services/ServiceDiscover';
import ServiceHardware from './services/ServiceHardware';
import ServiceHistory from './services/ServiceHistory';
import ServiceMarket from './services/ServiceMarket';
import ServiceNameResolver from './services/ServiceNameResolver';
import ServiceNetwork from './services/ServiceNetwork';
import ServiceNFT from './services/ServiceNFT';
import ServiceNotification from './services/serviceNotification';
import ServiceOnboarding from './services/ServiceOnboarding';
import ServicePassword from './services/ServicePassword';
import ServicePromise from './services/ServicePromise';
import ServiceRevoke from './services/ServiceRevoke';
import ServiceSocket from './services/ServiceSocket';
import ServiceStaking from './services/ServiceStaking';
import ServiceSwap from './services/ServiceSwap';
import ServiceToken from './services/ServiceToken';
import ServiceWalletConnect from './services/ServiceWalletConnect';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  engine = new Engine();

  validator = this.engine.validator;

  vaultFactory = this.engine.vaultFactory;

  walletConnect = new ProviderApiWalletConnect({
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

  serviceAccountSelector = new ServiceAccountSelector({
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

  serviceWalletConnect = new ServiceWalletConnect({
    backgroundApi: this,
  });

  serviceHistory = new ServiceHistory({
    backgroundApi: this,
  });

  serviceHardware = new ServiceHardware({
    backgroundApi: this,
  });

  servicePassword = new ServicePassword({
    backgroundApi: this,
  });

  serviceSwap = new ServiceSwap({
    backgroundApi: this,
  });

  serviceCloudBackup = new ServiceCloudBackup({
    backgroundApi: this,
  });

  serviceStaking = new ServiceStaking({
    backgroundApi: this,
  });

  serviceNameResolver = new ServiceNameResolver({
    backgroundApi: this,
  });

  serviceNFT = new ServiceNFT({
    backgroundApi: this,
  });

  serviceNotification = new ServiceNotification({
    backgroundApi: this,
  });

  serviceSocket = new ServiceSocket({
    backgroundApi: this,
  });

  serviceBootstrap = new ServiceBootstrap({
    backgroundApi: this,
  });

  serviceDiscover = new ServiceDiscover({
    backgroundApi: this,
  });

  serviceMarket = new ServiceMarket({ backgroundApi: this });

  serviceRevoke = new ServiceRevoke({
    backgroundApi: this,
  });
}
export default BackgroundApi;
