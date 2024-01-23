/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line import/order
import { Engine } from '@onekeyhq/engine';

import BackgroundApiBase from './BackgroundApiBase';

import type { IBackgroundApi } from './IBackgroundApi';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  engine = new Engine();

  validator = this.engine.validator;

  vaultFactory = this.engine.vaultFactory;

  get walletConnect() {
    const ProviderApiWalletConnect =
      require('./providers/ProviderApiWalletConnect/ProviderApiWalletConnect') as typeof import('./providers/ProviderApiWalletConnect/ProviderApiWalletConnect');
    const value = new ProviderApiWalletConnect.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'walletConnect', { value });
    return value;
  }

  get servicePromise() {
    const ServicePromise =
      require('./services/ServicePromise') as typeof import('./services/ServicePromise');
    const value = new ServicePromise.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePromise', { value });
    return value;
  }

  get serviceDapp() {
    const ServiceDapp =
      require('./services/ServiceDapp') as typeof import('./services/ServiceDapp');
    const value = new ServiceDapp.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDapp', { value });
    return value;
  }

  get serviceAccount() {
    const ServiceAccount =
      require('./services/ServiceAccount') as typeof import('./services/ServiceAccount');
    const value = new ServiceAccount.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAccount', { value });
    return value;
  }

  get serviceExternalAccount() {
    const ServiceExternalAccount =
      require('./services/ServiceExternalAccount') as typeof import('./services/ServiceExternalAccount');
    const value = new ServiceExternalAccount.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceExternalAccount', { value });
    return value;
  }

  get serviceNetwork() {
    const ServiceNetwork =
      require('./services/ServiceNetwork') as typeof import('./services/ServiceNetwork');
    const value = new ServiceNetwork.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNetwork', { value });
    return value;
  }

  get serviceApp() {
    const ServiceApp =
      require('./services/ServiceApp') as typeof import('./services/ServiceApp');
    const value = new ServiceApp.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceApp', { value });
    return value;
  }

  get serviceAccountSelector() {
    const ServiceAccountSelector =
      require('./services/ServiceAccountSelector') as typeof import('./services/ServiceAccountSelector');
    const value = new ServiceAccountSelector.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAccountSelector', { value });
    return value;
  }

  get serviceCronJob() {
    const ServiceCronJob =
      require('./services/ServiceCronJob') as typeof import('./services/ServiceCronJob');
    const value = new ServiceCronJob.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceCronJob', { value });
    return value;
  }

  get serviceOnboarding() {
    const ServiceOnboarding =
      require('./services/ServiceOnboarding') as typeof import('./services/ServiceOnboarding');
    const value = new ServiceOnboarding.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceOnboarding', { value });
    return value;
  }

  get serviceToken() {
    const ServiceToken =
      require('./services/ServiceToken') as typeof import('./services/ServiceToken');
    const value = new ServiceToken.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceToken', { value });
    return value;
  }

  get serviceWalletConnect() {
    const ServiceWalletConnect =
      require('./services/ServiceWalletConnect') as typeof import('./services/ServiceWalletConnect');
    const value = new ServiceWalletConnect.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceWalletConnect', { value });
    return value;
  }

  get serviceHistory() {
    const ServiceHistory =
      require('./services/ServiceHistory') as typeof import('./services/ServiceHistory');
    const value = new ServiceHistory.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHistory', { value });
    return value;
  }

  get serviceHardware() {
    const ServiceHardware =
      require('./services/ServiceHardware') as typeof import('./services/ServiceHardware');
    const value = new ServiceHardware.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHardware', { value });
    return value;
  }

  get servicePassword() {
    const ServicePassword =
      require('./services/ServicePassword') as typeof import('./services/ServicePassword');
    const value = new ServicePassword.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePassword', { value });
    return value;
  }

  get serviceSwap() {
    const ServiceSwap =
      require('./services/ServiceSwap') as typeof import('./services/ServiceSwap');
    const value = new ServiceSwap.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSwap', { value });
    return value;
  }

  get serviceCloudBackup() {
    const ServiceCloudBackup =
      require('./services/ServiceCloudBackup') as typeof import('./services/ServiceCloudBackup');
    const value = new ServiceCloudBackup.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceCloudBackup', { value });
    return value;
  }

  get serviceStaking() {
    const ServiceStaking =
      require('./services/ServiceStaking') as typeof import('./services/ServiceStaking');
    const value = new ServiceStaking.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceStaking', { value });
    return value;
  }

  get serviceNameResolver() {
    const ServiceNameResolver =
      require('./services/ServiceNameResolver') as typeof import('./services/ServiceNameResolver');
    const value = new ServiceNameResolver.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNameResolver', { value });
    return value;
  }

  get serviceNFT() {
    const ServiceNFT =
      require('./services/ServiceNFT') as typeof import('./services/ServiceNFT');
    const value = new ServiceNFT.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNFT', { value });
    return value;
  }

  get serviceNotification() {
    const ServiceNotification =
      require('./services/ServiceNotification') as typeof import('./services/ServiceNotification');
    const value = new ServiceNotification.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNotification', { value });
    return value;
  }

  get serviceSocket() {
    const ServiceSocket =
      require('./services/ServiceSocket') as typeof import('./services/ServiceSocket');
    const value = new ServiceSocket.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSocket', { value });
    return value;
  }

  get serviceBootstrap() {
    const ServiceBootstrap =
      require('./services/ServiceBootstrap') as typeof import('./services/ServiceBootstrap');
    const value = new ServiceBootstrap.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceBootstrap', { value });
    return value;
  }

  get serviceDiscover() {
    const ServiceDiscover =
      require('./services/ServiceDiscover') as typeof import('./services/ServiceDiscover');
    const value = new ServiceDiscover.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDiscover', { value });
    return value;
  }

  get serviceMarket() {
    const ServiceMarket =
      require('./services/ServiceMarket') as typeof import('./services/ServiceMarket');
    const value = new ServiceMarket.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceMarket', { value });
    return value;
  }

  get serviceRevoke() {
    const ServiceRevoke =
      require('./services/ServiceRevoke') as typeof import('./services/ServiceRevoke');
    const value = new ServiceRevoke.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceRevoke', { value });
    return value;
  }

  get serviceSetting() {
    const ServiceSetting =
      require('./services/ServiceSetting') as typeof import('./services/ServiceSetting');
    const value = new ServiceSetting.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSetting', { value });
    return value;
  }

  get serviceBatchTransfer() {
    const ServiceBatchTransfer =
      require('./services/ServiceBatchTransfer') as typeof import('./services/ServiceBatchTransfer');
    const value = new ServiceBatchTransfer.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceBatchTransfer', { value });
    return value;
  }

  get servicePrice() {
    const ServicePrice =
      require('./services/ServicePrice') as typeof import('./services/ServicePrice');
    const value = new ServicePrice.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePrice', { value });
    return value;
  }

  get serviceTransaction() {
    const ServiceTransaction =
      require('./services/ServiceTransaction') as typeof import('./services/ServiceTransaction');
    const value = new ServiceTransaction.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceTransaction', { value });
    return value;
  }

  get serviceOverview() {
    const ServiceOverview =
      require('./services/ServiceOverview') as typeof import('./services/ServiceOverview');
    const value = new ServiceOverview.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceOverview', { value });
    return value;
  }

  get serviceMigrate() {
    const ServiceMigrate =
      require('./services/ServiceMigrate') as typeof import('./services/ServiceMigrate');
    const value = new ServiceMigrate.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceMigrate', { value });

    return value;
  }

  get serviceHTTP() {
    const ServiceHTTP =
      require('./services/ServiceHTTP') as typeof import('./services/ServiceHTTP');
    const value = new ServiceHTTP.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHTTP', { value });

    return value;
  }

  get serviceDerivationPath() {
    const ServiceDerivationPath =
      require('./services/ServiceDerivationPath') as typeof import('./services/ServiceDerivationPath');
    const value = new ServiceDerivationPath.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDerivationPath', { value });

    return value;
  }

  get serviceFiatPay() {
    const ServiceFiatPay =
      require('./services/ServiceFiatPay') as typeof import('./services/ServiceFiatPay');
    const value = new ServiceFiatPay.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceFiatPay', { value });
    return value;
  }

  get serviceAddressbook() {
    const ServiceAddressbook =
      require('./services/ServiceAddressbook') as typeof import('./services/ServiceAddressbook');
    const value = new ServiceAddressbook.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAddressbook', { value });
    return value;
  }

  get serviceLimitOrder() {
    const ServiceLimitOrder =
      require('./services/ServiceLimitOrder') as typeof import('./services/ServiceLimitOrder');
    const value = new ServiceLimitOrder.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceLimitOrder', { value });
    return value;
  }

  get serviceUtxos() {
    const ServiceUtxos =
      require('./services/ServiceUtxos') as typeof import('./services/ServiceUtxos');
    const value = new ServiceUtxos.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceUtxos', { value });
    return value;
  }

  get serviceContract() {
    const ServiceContract =
      require('./services/ServiceContract') as typeof import('./services/ServiceContract');
    const value = new ServiceContract.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceContract', { value });
    return value;
  }

  get serviceLightningNetwork() {
    const ServiceLightningNetwork =
      require('./services/ServiceLightningNetwork') as typeof import('./services/ServiceLightningNetwork');
    const value = new ServiceLightningNetwork.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceLightningNetwork', { value });
    return value;
  }

  get serviceGas() {
    const ServiceGas =
      require('./services/ServiceGas') as typeof import('./services/ServiceGas');
    const value = new ServiceGas.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceGas', { value });
    return value;
  }

  get serviceInscribe() {
    const ServiceInscribe =
      require('./services/ServiceInscribe') as typeof import('./services/ServiceInscribe');
    const value = new ServiceInscribe.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceInscribe', { value });
    return value;
  }

  get serviceAllNetwork() {
    const ServiceAllNetwork =
      require('./services/ServiceAllNetwork') as typeof import('./services/ServiceAllNetwork');
    const value = new ServiceAllNetwork.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAllNetwork', { value });
    return value;
  }

  get serviceDappMetaData() {
    const ServiceDappMetaData =
      require('./services/ServiceDappMetaData') as typeof import('./services/ServiceDappMetaData');
    const value = new ServiceDappMetaData.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDappMetaData', { value });
    return value;
  }

  get serviceBRC20() {
    const ServiceBRC20 =
      require('./services/ServiceBRC20') as typeof import('./services/ServiceBRC20');
    const value = new ServiceBRC20.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceBRC20', { value });
    return value;
  }

  get serviceNostr() {
    const ServiceNostr =
      require('./services/ServiceNostr') as typeof import('./services/ServiceNostr');
    const value = new ServiceNostr.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNostr', { value });
    return value;
  }
}
export default BackgroundApi;
