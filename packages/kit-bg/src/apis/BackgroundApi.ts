/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// eslint-disable-next-line import/order

import externalWalletFactory from '../connectors/externalWalletFactory';
import localDb from '../dbs/local/localDb';
import simpleDb from '../dbs/simple/simpleDb';
import { vaultFactory } from '../vaults/factory';

import BackgroundApiBase from './BackgroundApiBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type ServiceHyperliquidExchange from '../services/ServiceHyperLiquid/ServiceHyperliquidExchange';
import type ServiceHyperliquidSubscription from '../services/ServiceHyperLiquid/ServiceHyperliquidSubscription';
import type ServiceHyperliquidWallet from '../services/ServiceHyperLiquid/ServiceHyperliquidWallet';

class BackgroundApi extends BackgroundApiBase implements IBackgroundApi {
  constructor() {
    super();
    vaultFactory.setBackgroundApi(this);
    externalWalletFactory.setBackgroundApi(this);
    localDb.setBackgroundApi(this);
    void this.serviceBootstrap.init();
  }

  simpleDb = simpleDb;

  localDb = localDb;
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

  get serviceWebviewPerp() {
    const Service =
      require('../services/ServiceWebviewPerp') as typeof import('../services/ServiceWebviewPerp');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceWebviewPerp', { value });
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

  get serviceAppCleanup() {
    const ServiceAppCleanup =
      require('../services/ServiceAppCleanup') as typeof import('../services/ServiceAppCleanup');
    const value = new ServiceAppCleanup.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceAppCleanup', { value });
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

  get serviceTransaction() {
    const ServiceTransaction =
      require('../services/ServiceTransaction') as typeof import('../services/ServiceTransaction');
    const value = new ServiceTransaction.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceTransaction', { value });
    return value;
  }

  get serviceDeFi() {
    const ServiceDeFi =
      require('../services/ServiceDeFi') as typeof import('../services/ServiceDeFi');
    const value = new ServiceDeFi.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDeFi', { value });
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

  get serviceCloudBackupV2() {
    const ServiceCloudBackupV2 =
      require('../services/ServiceCloudBackupV2') as typeof import('../services/ServiceCloudBackupV2');
    const value = new ServiceCloudBackupV2.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceCloudBackupV2', { value });
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

  get servicePrime() {
    const Service =
      require('../services/ServicePrime') as typeof import('../services/ServicePrime');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePrime', { value });
    return value;
  }

  get servicePrimeCloudSync() {
    const Service =
      require('../services/ServicePrimeCloudSync') as typeof import('../services/ServicePrimeCloudSync');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePrimeCloudSync', { value });
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

  get serviceFreshAddress() {
    const Service =
      require('../services/ServiceFreshAddress') as typeof import('../services/ServiceFreshAddress');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceFreshAddress', { value });
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
    const Service =
      require('../services/ServiceAddressBook') as typeof import('../services/ServiceAddressBook');
    const value = new Service.default({
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

  get serviceMarketV2() {
    const ServiceMarketV2 =
      require('../services/ServiceMarketV2') as typeof import('../services/ServiceMarketV2');
    const value = new ServiceMarketV2.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceMarketV2', { value });
    return value;
  }

  get serviceMarketWS() {
    const ServiceMarketWS =
      require('../services/ServiceMarketWS') as typeof import('../services/ServiceMarketWS');
    const value = new ServiceMarketWS.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceMarketWS', { value });
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

  get serviceSignatureConfirm() {
    const ServiceSignatureConfirm =
      require('../services/ServiceSignatureConfirm') as typeof import('../services/ServiceSignatureConfirm');
    const value = new ServiceSignatureConfirm.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceSignatureConfirm', { value });
    return value;
  }

  get serviceMasterPassword() {
    const ServiceMasterPassword =
      require('../services/ServiceMasterPassword') as typeof import('../services/ServiceMasterPassword');
    const value = new ServiceMasterPassword.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceMasterPassword', { value });
    return value;
  }

  get serviceReferralCode() {
    const ServiceReferralCode =
      require('../services/ServiceReferralCode') as typeof import('../services/ServiceReferralCode');
    const value = new ServiceReferralCode.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceReferralCode', { value });
    return value;
  }

  get serviceDBBackup() {
    const ServiceDBBackup =
      require('../services/ServiceDBBackup') as typeof import('../services/ServiceDBBackup');
    const value = new ServiceDBBackup.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceDBBackup', { value });
    return value;
  }

  get servicePrimeTransfer() {
    const ServicePrimeTransfer =
      require('../services/ServicePrimeTransfer') as typeof import('../services/ServicePrimeTransfer');
    const value = new ServicePrimeTransfer.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'servicePrimeTransfer', { value });
    return value;
  }

  get serviceWalletBanner() {
    const ServiceWalletBanner =
      require('../services/ServiceWalletBanner') as typeof import('../services/ServiceWalletBanner');
    const value = new ServiceWalletBanner.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceWalletBanner', { value });
    return value;
  }

  get serviceWalletStatus() {
    const ServiceWalletStatus =
      require('../services/ServiceWalletStatus') as typeof import('../services/ServiceWalletStatus');
    const value = new ServiceWalletStatus.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceWalletStatus', { value });
    return value;
  }

  get serviceApproval() {
    const ServiceApproval =
      require('../services/ServiceApproval') as typeof import('../services/ServiceApproval');
    const value = new ServiceApproval.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceApproval', { value });
    return value;
  }

  get serviceInternalSignAndVerify() {
    const ServiceInternalSignAndVerify =
      require('../services/ServiceInternalSignAndVerify') as typeof import('../services/ServiceInternalSignAndVerify');
    const value = new ServiceInternalSignAndVerify.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceInternalSignAndVerify', { value });
    return value;
  }

  get serviceHyperliquid() {
    const Service =
      require('../services/ServiceHyperLiquid/ServiceHyperliquid') as typeof import('../services/ServiceHyperLiquid/ServiceHyperliquid');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHyperliquid', { value });
    return value;
  }

  get serviceHyperliquidExchange(): ServiceHyperliquidExchange {
    const Service =
      require('../services/ServiceHyperLiquid/ServiceHyperliquidExchange') as typeof import('../services/ServiceHyperLiquid/ServiceHyperliquidExchange');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHyperliquidExchange', { value });
    return value;
  }

  get serviceHyperliquidWallet(): ServiceHyperliquidWallet {
    const Service =
      require('../services/ServiceHyperLiquid/ServiceHyperliquidWallet') as typeof import('../services/ServiceHyperLiquid/ServiceHyperliquidWallet');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHyperliquidWallet', { value });
    return value;
  }

  get serviceHyperliquidSubscription(): ServiceHyperliquidSubscription {
    const Service =
      require('../services/ServiceHyperLiquid/ServiceHyperliquidSubscription') as typeof import('../services/ServiceHyperLiquid/ServiceHyperliquidSubscription');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceHyperliquidSubscription', { value });
    return value;
  }

  get serviceKeylessWallet() {
    const Service =
      require('../services/ServiceKeylessWallet/ServiceKeylessWallet') as typeof import('../services/ServiceKeylessWallet/ServiceKeylessWallet');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceKeylessWallet', { value });
    return value;
  }

  get serviceIpTable() {
    const ServiceIpTable =
      require('../services/ServiceIpTable') as typeof import('../services/ServiceIpTable');
    const value = new ServiceIpTable.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceIpTable', { value });
    return value;
  }

  get serviceNetworkDoctor() {
    const ServiceNetworkDoctor =
      require('../services/ServiceNetworkDoctor') as typeof import('../services/ServiceNetworkDoctor');
    const value = new ServiceNetworkDoctor.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceNetworkDoctor', { value });
    return value;
  }

  get serviceOneKeyID() {
    const Service =
      require('../services/ServiceOneKeyID') as typeof import('../services/ServiceOneKeyID');
    const value = new Service.default({
      backgroundApi: this,
    });
    Object.defineProperty(this, 'serviceOneKeyID', { value });
    return value;
  }
}
export default BackgroundApi;
