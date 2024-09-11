/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line import/order

import externalWalletFactory from '../connectors/externalWalletFactory';
import simpleDb from '../dbs/simple/simpleDb';
import { vaultFactory } from '../vaults/factory';

import BackgroundApiBase from './BackgroundApiBase';

import type { IBackgroundApi } from './IBackgroundApi';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  constructor() {
    super();
    vaultFactory.setBackgroundApi(this);
    externalWalletFactory.setBackgroundApi(this);
    void this.serviceBootstrap.init();
  }

  simpleDb = simpleDb;
  // validator = this.engine.validator;

  // vaultFactory = this.engine.vaultFactory;

  get walletConnect() {
    const ProviderApiWalletConnect =
      require('../providers/ProviderApiWalletConnect/ProviderApiWalletConnect') as typeof import('../providers/ProviderApiWalletConnect/ProviderApiWalletConnect');
    const value = new ProviderApiWalletConnect.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'walletConnect', { value });
    return value;
  }

  get servicePromise() {
    const Service =
      require('../services/ServicePromise') as typeof import('../services/ServicePromise');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePromise', { value });
    return value;
  }

  get serviceApp() {
    const Service =
      require('../services/ServiceApp') as typeof import('../services/ServiceApp');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceApp', { value });
    return value;
  }

  get serviceDemo() {
    const Service =
      require('../services/ServiceDemo') as typeof import('../services/ServiceDemo');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDemo', { value });
    return value;
  }

  get serviceV4Migration() {
    const Service =
      require('../services/ServiceV4Migration') as typeof import('../services/ServiceV4Migration');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceV4Migration', { value });
    return value;
  }

  get servicePassword() {
    const Service =
      require('../services/ServicePassword') as typeof import('../services/ServicePassword');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePassword', { value });
    return value;
  }

  get serviceNetwork() {
    const Service =
      require('../services/ServiceNetwork') as typeof import('../services/ServiceNetwork');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNetwork', { value });
    return value;
  }

  get serviceAccount() {
    const Service =
      require('../services/ServiceAccount') as typeof import('../services/ServiceAccount');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAccount', { value });
    return value;
  }

  get serviceAccountSelector() {
    const Service =
      require('../services/ServiceAccountSelector') as typeof import('../services/ServiceAccountSelector');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAccountSelector', { value });
    return value;
  }

  get serviceDevSetting() {
    const Service =
      require('../services/ServiceDevSetting') as typeof import('../services/ServiceDevSetting');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDevSetting', { value });
    return value;
  }

  get serviceSetting() {
    const Service =
      require('../services/ServiceSetting') as typeof import('../services/ServiceSetting');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSetting', { value });
    return value;
  }

  get serviceSend() {
    const ServiceSend =
      require('../services/ServiceSend') as typeof import('../services/ServiceSend');
    const value = new ServiceSend.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSend', { value });
    return value;
  }

  get serviceSwap() {
    const ServiceSwap =
      require('../services/ServiceSwap') as typeof import('../services/ServiceSwap');
    const value = new ServiceSwap.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSwap', { value });
    return value;
  }

  get serviceBootstrap() {
    const Service =
      require('../services/ServiceBootstrap') as typeof import('../services/ServiceBootstrap');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceBootstrap', { value });
    return value;
  }

  get serviceToken() {
    const ServiceToken =
      require('../services/ServiceToken') as typeof import('../services/ServiceToken');
    const value = new ServiceToken.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceToken', { value });
    return value;
  }

  get serviceNFT() {
    const ServiceNFT =
      require('../services/ServiceNFT') as typeof import('../services/ServiceNFT');
    const value = new ServiceNFT.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNFT', { value });
    return value;
  }

  get serviceHistory() {
    const ServiceHistory =
      require('../services/ServiceHistory') as typeof import('../services/ServiceHistory');
    const value = new ServiceHistory.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHistory', { value });
    return value;
  }

  get serviceDefi() {
    const ServiceDefi =
      require('../services/ServiceDefi') as typeof import('../services/ServiceDefi');
    const value = new ServiceDefi.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDefi', { value });
    return value;
  }

  get serviceScanQRCode() {
    const ServiceScanQRCode =
      require('../services/ServiceScanQRCode') as typeof import('../services/ServiceScanQRCode');
    const value = new ServiceScanQRCode.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceScanQRCode', { value });
    return value;
  }

  get serviceCloudBackup() {
    const ServiceCloudBackup =
      require('../services/ServiceCloudBackup') as typeof import('../services/ServiceCloudBackup');
    const value = new ServiceCloudBackup.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceCloudBackup', { value });
    return value;
  }

  get serviceLiteCardMnemonic() {
    const ServiceLiteCardMnemonic =
      require('../services/ServiceLiteCardMnemonic') as typeof import('../services/ServiceLiteCardMnemonic');
    const value = new ServiceLiteCardMnemonic.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceLiteCardMnemonic', { value });
    return value;
  }

  get serviceValidator() {
    const ServiceValidator =
      require('../services/ServiceValidator') as typeof import('../services/ServiceValidator');
    const value = new ServiceValidator.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceValidator', { value });
    return value;
  }

  get serviceNameResolver() {
    const ServiceNameResolver =
      require('../services/ServiceNameResolver') as typeof import('../services/ServiceNameResolver');
    const value = new ServiceNameResolver.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNameResolver', { value });
    return value;
  }

  get serviceGas() {
    const ServiceGas =
      require('../services/ServiceGas') as typeof import('../services/ServiceGas');
    const value = new ServiceGas.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceGas', { value });
    return value;
  }

  get serviceDiscovery() {
    const ServiceDiscovery =
      require('../services/ServiceDiscovery') as typeof import('../services/ServiceDiscovery');
    const value = new ServiceDiscovery.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDiscovery', { value });
    return value;
  }

  get serviceDApp() {
    const ServiceDApp =
      require('../services/ServiceDApp') as typeof import('../services/ServiceDApp');
    const value = new ServiceDApp.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDApp', { value });
    return value;
  }

  get serviceDappSide() {
    const ServiceDappSide =
      require('../services/ServiceDappSide') as typeof import('../services/ServiceDappSide');
    const value = new ServiceDappSide.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDappSide', { value });
    return value;
  }

  get serviceWalletConnect() {
    const Service =
      require('../services/ServiceWalletConnect') as typeof import('../services/ServiceWalletConnect');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceWalletConnect', { value });
    return value;
  }

  get serviceNotification() {
    const Service =
      require('../services/ServiceNotification') as typeof import('../services/ServiceNotification');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNotification', { value });
    return value;
  }

  get serviceQrWallet() {
    const Service =
      require('../services/ServiceQrWallet') as typeof import('../services/ServiceQrWallet');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceQrWallet', { value });
    return value;
  }

  get serviceAccountProfile() {
    const ServiceAccountProfile =
      require('../services/ServiceAccountProfile') as typeof import('../services/ServiceAccountProfile');
    const value = new ServiceAccountProfile.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAccountProfile', { value });
    return value;
  }

  get serviceBatchCreateAccount() {
    const Service =
      require('../services/ServiceBatchCreateAccount') as typeof import('../services/ServiceBatchCreateAccount');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceBatchCreateAccount', { value });
    return value;
  }

  get serviceAllNetwork() {
    const Service =
      require('../services/ServiceAllNetwork') as typeof import('../services/ServiceAllNetwork');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAllNetwork', { value });
    return value;
  }

  get serviceHardware() {
    const ServiceHardware =
      require('../services/ServiceHardware') as typeof import('../services/ServiceHardware');
    const value = new ServiceHardware.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHardware', { value });
    return value;
  }

  get serviceHardwareUI() {
    const Service =
      require('../services/ServiceHardwareUI') as typeof import('../services/ServiceHardwareUI');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHardwareUI', { value });
    return value;
  }

  get serviceFirmwareUpdate() {
    const Service =
      require('../services/ServiceFirmwareUpdate') as typeof import('../services/ServiceFirmwareUpdate');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceFirmwareUpdate', { value });
    return value;
  }

  get serviceOnboarding() {
    const Service =
      require('../services/ServiceOnboarding') as typeof import('../services/ServiceOnboarding');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceOnboarding', { value });
    return value;
  }

  get serviceAddressBook() {
    const ServiceAddressBook =
      require('../services/ServiceAddressBook') as typeof import('../services/ServiceAddressBook');
    const value = new ServiceAddressBook.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAddressBook', { value });
    return value;
  }

  get serviceAppUpdate() {
    const ServiceAppUpdate =
      require('../services/ServiceAppUpdate') as typeof import('../services/ServiceAppUpdate');
    const value = new ServiceAppUpdate.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAppUpdate', { value });
    return value;
  }

  get serviceSpotlight() {
    const ServiceSpotlight =
      require('../services/ServiceSpotlight') as typeof import('../services/ServiceSpotlight');
    const value = new ServiceSpotlight.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSpotlight', { value });
    return value;
  }

  get serviceMarket() {
    const ServiceMarket =
      require('../services/ServiceMarket') as typeof import('../services/ServiceMarket');
    const value = new ServiceMarket.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceMarket', { value });
    return value;
  }

  get serviceE2E() {
    const Service =
      require('../services/ServiceE2E') as typeof import('../services/ServiceE2E');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceE2E', { value });
    return value;
  }

  get serviceLightning() {
    const Service =
      require('../services/ServiceLightning') as typeof import('../services/ServiceLightning');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceLightning', { value });
    return value;
  }

  get serviceLogger() {
    const Service =
      require('../services/ServiceLogger') as typeof import('../services/ServiceLogger');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceLogger', { value });
    return value;
  }

  get serviceContextMenu() {
    const ServiceContextMenu =
      require('../services/ServiceContextMenu') as typeof import('../services/ServiceContextMenu');
    const value = new ServiceContextMenu.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceContextMenu', { value });
    return value;
  }

  get serviceFiatCrypto() {
    const ServiceFiatCrypto =
      require('../services/ServiceFiatCrypto') as typeof import('../services/ServiceFiatCrypto');
    const value = new ServiceFiatCrypto.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceFiatCrypto', { value });
    return value;
  }

  get serviceSignature() {
    const ServiceSignature =
      require('../services/ServiceSignature') as typeof import('../services/ServiceSignature');
    const value = new ServiceSignature.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSignature', { value });
    return value;
  }

  get serviceNostr() {
    const ServiceNostr =
      require('../services/ServiceNostr') as typeof import('../services/ServiceNostr');
    const value = new ServiceNostr.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNostr', { value });
    return value;
  }

  get serviceUniversalSearch() {
    const ServiceUniversalSearch =
      require('../services/ServiceUniversalSearch') as typeof import('../services/ServiceUniversalSearch');
    const value = new ServiceUniversalSearch.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceUniversalSearch', { value });
    return value;
  }

  get serviceStaking() {
    const ServiceStaking =
      require('../services/ServiceStaking') as typeof import('../services/ServiceStaking');
    const value = new ServiceStaking.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceStaking', { value });
    return value;
  }

  get serviceExplorer() {
    const ServiceExplorer =
      require('../services/ServiceExplorer') as typeof import('../services/ServiceExplorer');
    const value = new ServiceExplorer.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceExplorer', { value });
    return value;
  }

  get serviceCustomToken() {
    const ServiceCustomToken =
      require('../services/ServiceCustomToken') as typeof import('../services/ServiceCustomToken');
    const value = new ServiceCustomToken.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceCustomToken', { value });
    return value;
  }

  get serviceCustomRpc() {
    const ServiceCustomRpc =
      require('../services/ServiceCustomRpc') as typeof import('../services/ServiceCustomRpc');
    const value = new ServiceCustomRpc.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceCustomRpc', { value });
    return value;
  }
}
export default BackgroundApi;
