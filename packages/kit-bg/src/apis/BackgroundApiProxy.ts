/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbProxy } from '../dbs/simple/base/SimpleDbProxy';

import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';

import type { IBackgroundApi } from './IBackgroundApi';
import type { ProviderApiWalletConnect } from '../providers/ProviderApiWalletConnect';
import type ServiceAccount from '../services/ServiceAccount';
import type ServiceAccountProfile from '../services/ServiceAccountProfile';
import type ServiceAccountSelector from '../services/ServiceAccountSelector';
import type ServiceAddressBook from '../services/ServiceAddressBook';
import type ServiceAddressRiskCheck from '../services/ServiceAddressRiskCheck';
import type ServiceAllNetwork from '../services/ServiceAllNetwork';
import type ServiceApp from '../services/ServiceApp';
import type ServiceAppCleanup from '../services/ServiceAppCleanup';
import type ServiceApproval from '../services/ServiceApproval';
import type ServiceAppUpdate from '../services/ServiceAppUpdate';
import type ServiceBatchCreateAccount from '../services/ServiceBatchCreateAccount';
import type ServiceBootstrap from '../services/ServiceBootstrap';
import type ServiceCloudBackup from '../services/ServiceCloudBackup';
import type ServiceCloudBackupV2 from '../services/ServiceCloudBackupV2';
import type ServiceContextMenu from '../services/ServiceContextMenu';
import type ServiceCustomRpc from '../services/ServiceCustomRpc';
import type ServiceCustomToken from '../services/ServiceCustomToken';
import type ServiceDApp from '../services/ServiceDApp';
import type ServiceDappSide from '../services/ServiceDappSide';
import type ServiceDBBackup from '../services/ServiceDBBackup';
import type ServiceDeFi from '../services/ServiceDeFi';
import type ServiceDemo from '../services/ServiceDemo';
import type ServiceDevSetting from '../services/ServiceDevSetting';
import type ServiceDiscovery from '../services/ServiceDiscovery';
import type ServiceE2E from '../services/ServiceE2E';
import type ServiceExplorer from '../services/ServiceExplorer';
import type ServiceFiatCrypto from '../services/ServiceFiatCrypto';
import type ServiceFirmwareUpdate from '../services/ServiceFirmwareUpdate';
import type ServiceFreshAddress from '../services/ServiceFreshAddress';
import type ServiceGas from '../services/ServiceGas';
import type ServiceHardware from '../services/ServiceHardware';
import type ServiceHardwareUI from '../services/ServiceHardwareUI';
import type ServiceHistory from '../services/ServiceHistory';
import type ServiceHyperliquid from '../services/ServiceHyperLiquid/ServiceHyperliquid';
import type ServiceHyperliquidCache from '../services/ServiceHyperLiquid/ServiceHyperliquidCache';
import type ServiceHyperliquidExchange from '../services/ServiceHyperLiquid/ServiceHyperliquidExchange';
import type ServiceHyperliquidReferral from '../services/ServiceHyperLiquid/ServiceHyperliquidReferral';
import type ServiceHyperliquidSubscription from '../services/ServiceHyperLiquid/ServiceHyperliquidSubscription';
import type ServiceHyperliquidWallet from '../services/ServiceHyperLiquid/ServiceHyperliquidWallet';
import type ServiceInternalSignAndVerify from '../services/ServiceInternalSignAndVerify';
import type ServiceIpTable from '../services/ServiceIpTable';
import type ServiceKeylessCloudSync from '../services/ServiceKeylessCloudSync';
import type ServiceKeylessWallet from '../services/ServiceKeylessWallet/ServiceKeylessWallet';
import type ServiceLightning from '../services/ServiceLightning';
import type ServiceLiteCardMnemonic from '../services/ServiceLiteCardMnemonic';
import type ServiceLogger from '../services/ServiceLogger';
import type ServiceMarket from '../services/ServiceMarket';
import type ServiceMarketV2 from '../services/ServiceMarketV2';
import type ServiceMarketWS from '../services/ServiceMarketWS';
import type ServiceMasterPassword from '../services/ServiceMasterPassword';
import type ServiceNameResolver from '../services/ServiceNameResolver';
import type ServiceNetwork from '../services/ServiceNetwork';
import type ServiceNetworkDoctor from '../services/ServiceNetworkDoctor';
import type ServiceNFT from '../services/ServiceNFT';
import type ServiceNostr from '../services/ServiceNostr';
import type ServiceNotification from '../services/ServiceNotification';
import type ServiceOnboarding from '../services/ServiceOnboarding';
import type ServiceOneKeyID from '../services/ServiceOneKeyID';
import type ServicePassword from '../services/ServicePassword';
import type { ServicePendingInstallTask } from '../services/servicePendingInstallTask';
import type ServicePrime from '../services/ServicePrime';
import type ServicePrimeCloudSync from '../services/ServicePrimeCloudSync';
import type ServicePrimeTransfer from '../services/ServicePrimeTransfer';
// import type ServiceCronJob from './services/ServiceCronJob';
import type ServicePromise from '../services/ServicePromise';
import type ServiceQrWallet from '../services/ServiceQrWallet';
import type ServiceReferralCode from '../services/ServiceReferralCode';
import type ServiceRookieGuide from '../services/ServiceRookieGuide';
import type ServiceScanQRCode from '../services/ServiceScanQRCode';
import type ServiceSend from '../services/ServiceSend';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceSignature from '../services/ServiceSignature';
import type ServiceSignatureConfirm from '../services/ServiceSignatureConfirm';
import type ServiceSpotlight from '../services/ServiceSpotlight';
import type ServiceStaking from '../services/ServiceStaking';
import type ServiceSwap from '../services/ServiceSwap';
import type ServiceThirdPartyHardware from '../services/ServiceThirdPartyHardware';
import type ServiceToken from '../services/ServiceToken';
import type ServiceTokenViewModel from '../services/ServiceTokenViewModel';
import type ServiceTransaction from '../services/ServiceTransaction';
import type ServiceUniversalSearch from '../services/ServiceUniversalSearch';
import type ServiceV4Migration from '../services/ServiceV4Migration';
import type ServiceValidator from '../services/ServiceValidator';
import type ServiceWalletBanner from '../services/ServiceWalletBanner';
import type ServiceWalletConnect from '../services/ServiceWalletConnect';
import type ServiceWalletStatus from '../services/ServiceWalletStatus';
import type ServiceWebviewPerp from '../services/ServiceWebviewPerp';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  simpleDb = new SimpleDbProxy(this);

  localDb = new Proxy({} as any, {
    get: (_, prop) => {
      if (
        typeof prop === 'string' &&
        prop !== 'toString' &&
        prop !== 'valueOf' &&
        prop !== 'inspect'
      ) {
        return (..._args: any[]) => {
          throw new OneKeyLocalError(
            'localDb cannot be accessed from the UI layer',
          );
        };
      }
      return undefined;
    },
  });

  private readonly proxyServices = new Map<string, unknown>();

  private getProxyService<T>(serviceName: string): T {
    let service = this.proxyServices.get(serviceName);
    if (!service) {
      service = this._createProxyService(serviceName);
      this.proxyServices.set(serviceName, service);
    }
    return service as T;
  }

  get walletConnect(): ProviderApiWalletConnect {
    return this.getProxyService<ProviderApiWalletConnect>('walletConnect');
  }

  get servicePromise(): ServicePromise {
    return this.getProxyService<ServicePromise>('servicePromise');
  }

  get servicePassword(): ServicePassword {
    return this.getProxyService<ServicePassword>('servicePassword');
  }

  get serviceWebviewPerp(): ServiceWebviewPerp {
    return this.getProxyService<ServiceWebviewPerp>('serviceWebviewPerp');
  }

  get serviceDevSetting(): ServiceDevSetting {
    return this.getProxyService<ServiceDevSetting>('serviceDevSetting');
  }

  get serviceSetting(): ServiceSetting {
    return this.getProxyService<ServiceSetting>('serviceSetting');
  }

  get serviceAddressRiskCheck(): ServiceAddressRiskCheck {
    return this.getProxyService<ServiceAddressRiskCheck>(
      'serviceAddressRiskCheck',
    );
  }

  get serviceNetwork(): ServiceNetwork {
    return this.getProxyService<ServiceNetwork>('serviceNetwork');
  }

  get serviceAccount(): ServiceAccount {
    return this.getProxyService<ServiceAccount>('serviceAccount');
  }

  get serviceAccountSelector(): ServiceAccountSelector {
    return this.getProxyService<ServiceAccountSelector>(
      'serviceAccountSelector',
    );
  }

  get serviceApp(): ServiceApp {
    return this.getProxyService<ServiceApp>('serviceApp');
  }

  get serviceSend(): ServiceSend {
    return this.getProxyService<ServiceSend>('serviceSend');
  }

  get serviceSwap(): ServiceSwap {
    return this.getProxyService<ServiceSwap>('serviceSwap');
  }

  get serviceToken(): ServiceToken {
    return this.getProxyService<ServiceToken>('serviceToken');
  }

  get serviceTokenViewModel(): ServiceTokenViewModel {
    return this.getProxyService<ServiceTokenViewModel>('serviceTokenViewModel');
  }

  get serviceNFT(): ServiceNFT {
    return this.getProxyService<ServiceNFT>('serviceNFT');
  }

  get serviceAppCleanup(): ServiceAppCleanup {
    return this.getProxyService<ServiceAppCleanup>('serviceAppCleanup');
  }

  get serviceHistory(): ServiceHistory {
    return this.getProxyService<ServiceHistory>('serviceHistory');
  }

  get serviceTransaction(): ServiceTransaction {
    return this.getProxyService<ServiceTransaction>('serviceTransaction');
  }

  get serviceDeFi(): ServiceDeFi {
    return this.getProxyService<ServiceDeFi>('serviceDeFi');
  }

  get serviceValidator(): ServiceValidator {
    return this.getProxyService<ServiceValidator>('serviceValidator');
  }

  get serviceScanQRCode(): ServiceScanQRCode {
    return this.getProxyService<ServiceScanQRCode>('serviceScanQRCode');
  }

  get serviceCloudBackup(): ServiceCloudBackup {
    return this.getProxyService<ServiceCloudBackup>('serviceCloudBackup');
  }

  get serviceCloudBackupV2(): ServiceCloudBackupV2 {
    return this.getProxyService<ServiceCloudBackupV2>('serviceCloudBackupV2');
  }

  get serviceLiteCardMnemonic(): ServiceLiteCardMnemonic {
    return this.getProxyService<ServiceLiteCardMnemonic>(
      'serviceLiteCardMnemonic',
    );
  }

  get serviceNameResolver(): ServiceNameResolver {
    return this.getProxyService<ServiceNameResolver>('serviceNameResolver');
  }

  get serviceGas(): ServiceGas {
    return this.getProxyService<ServiceGas>('serviceGas');
  }

  get serviceDiscovery(): ServiceDiscovery {
    return this.getProxyService<ServiceDiscovery>('serviceDiscovery');
  }

  get serviceDemo(): ServiceDemo {
    return this.getProxyService<ServiceDemo>('serviceDemo');
  }

  get serviceV4Migration(): ServiceV4Migration {
    return this.getProxyService<ServiceV4Migration>('serviceV4Migration');
  }

  get serviceDApp(): ServiceDApp {
    return this.getProxyService<ServiceDApp>('serviceDApp');
  }

  get serviceDappSide(): ServiceDappSide {
    return this.getProxyService<ServiceDappSide>('serviceDappSide');
  }

  get serviceWalletConnect(): ServiceWalletConnect {
    return this.getProxyService<ServiceWalletConnect>('serviceWalletConnect');
  }

  get serviceNotification(): ServiceNotification {
    return this.getProxyService<ServiceNotification>('serviceNotification');
  }

  get servicePrime(): ServicePrime {
    return this.getProxyService<ServicePrime>('servicePrime');
  }

  get serviceMasterPassword(): ServiceMasterPassword {
    return this.getProxyService<ServiceMasterPassword>('serviceMasterPassword');
  }

  get servicePrimeCloudSync(): ServicePrimeCloudSync {
    return this.getProxyService<ServicePrimeCloudSync>('servicePrimeCloudSync');
  }

  get serviceKeylessCloudSync(): ServiceKeylessCloudSync {
    return this.getProxyService<ServiceKeylessCloudSync>(
      'serviceKeylessCloudSync',
    );
  }

  get serviceQrWallet(): ServiceQrWallet {
    return this.getProxyService<ServiceQrWallet>('serviceQrWallet');
  }

  get serviceAccountProfile(): ServiceAccountProfile {
    return this.getProxyService<ServiceAccountProfile>('serviceAccountProfile');
  }

  get serviceFreshAddress(): ServiceFreshAddress {
    return this.getProxyService<ServiceFreshAddress>('serviceFreshAddress');
  }

  get serviceBatchCreateAccount(): ServiceBatchCreateAccount {
    return this.getProxyService<ServiceBatchCreateAccount>(
      'serviceBatchCreateAccount',
    );
  }

  get serviceAllNetwork(): ServiceAllNetwork {
    return this.getProxyService<ServiceAllNetwork>('serviceAllNetwork');
  }

  get serviceOnboarding(): ServiceOnboarding {
    return this.getProxyService<ServiceOnboarding>('serviceOnboarding');
  }

  // serviceCronJob remains intentionally absent.

  get serviceBootstrap(): ServiceBootstrap {
    return this.getProxyService<ServiceBootstrap>('serviceBootstrap');
  }

  get serviceHardware(): ServiceHardware {
    return this.getProxyService<ServiceHardware>('serviceHardware');
  }

  get serviceHardwareUI(): ServiceHardwareUI {
    return this.getProxyService<ServiceHardwareUI>('serviceHardwareUI');
  }

  get serviceThirdPartyHardware(): ServiceThirdPartyHardware {
    return this.getProxyService<ServiceThirdPartyHardware>(
      'serviceThirdPartyHardware',
    );
  }

  get serviceFirmwareUpdate(): ServiceFirmwareUpdate {
    return this.getProxyService<ServiceFirmwareUpdate>('serviceFirmwareUpdate');
  }

  get serviceAddressBook(): ServiceAddressBook {
    return this.getProxyService<ServiceAddressBook>('serviceAddressBook');
  }

  get serviceAppUpdate(): ServiceAppUpdate {
    return this.getProxyService<ServiceAppUpdate>('serviceAppUpdate');
  }

  get servicePendingInstallTask(): ServicePendingInstallTask {
    return this.getProxyService<ServicePendingInstallTask>(
      'servicePendingInstallTask',
    );
  }

  get serviceSpotlight(): ServiceSpotlight {
    return this.getProxyService<ServiceSpotlight>('serviceSpotlight');
  }

  get serviceMarket(): ServiceMarket {
    return this.getProxyService<ServiceMarket>('serviceMarket');
  }

  get serviceMarketV2(): ServiceMarketV2 {
    return this.getProxyService<ServiceMarketV2>('serviceMarketV2');
  }

  get serviceMarketWS(): ServiceMarketWS {
    return this.getProxyService<ServiceMarketWS>('serviceMarketWS');
  }

  get serviceE2E(): ServiceE2E {
    return this.getProxyService<ServiceE2E>('serviceE2E');
  }

  get serviceLightning(): ServiceLightning {
    return this.getProxyService<ServiceLightning>('serviceLightning');
  }

  get serviceLogger(): ServiceLogger {
    return this.getProxyService<ServiceLogger>('serviceLogger');
  }

  get serviceContextMenu(): ServiceContextMenu {
    return this.getProxyService<ServiceContextMenu>('serviceContextMenu');
  }

  get serviceFiatCrypto(): ServiceFiatCrypto {
    return this.getProxyService<ServiceFiatCrypto>('serviceFiatCrypto');
  }

  get serviceSignature(): ServiceSignature {
    return this.getProxyService<ServiceSignature>('serviceSignature');
  }

  get serviceNostr(): ServiceNostr {
    return this.getProxyService<ServiceNostr>('serviceNostr');
  }

  get serviceUniversalSearch(): ServiceUniversalSearch {
    return this.getProxyService<ServiceUniversalSearch>(
      'serviceUniversalSearch',
    );
  }

  get serviceStaking(): ServiceStaking {
    return this.getProxyService<ServiceStaking>('serviceStaking');
  }

  get serviceExplorer(): ServiceExplorer {
    return this.getProxyService<ServiceExplorer>('serviceExplorer');
  }

  get serviceCustomToken(): ServiceCustomToken {
    return this.getProxyService<ServiceCustomToken>('serviceCustomToken');
  }

  get serviceCustomRpc(): ServiceCustomRpc {
    return this.getProxyService<ServiceCustomRpc>('serviceCustomRpc');
  }

  get serviceSignatureConfirm(): ServiceSignatureConfirm {
    return this.getProxyService<ServiceSignatureConfirm>(
      'serviceSignatureConfirm',
    );
  }

  get serviceReferralCode(): ServiceReferralCode {
    return this.getProxyService<ServiceReferralCode>('serviceReferralCode');
  }

  get serviceDBBackup(): ServiceDBBackup {
    return this.getProxyService<ServiceDBBackup>('serviceDBBackup');
  }

  get servicePrimeTransfer(): ServicePrimeTransfer {
    return this.getProxyService<ServicePrimeTransfer>('servicePrimeTransfer');
  }

  get serviceWalletBanner(): ServiceWalletBanner {
    return this.getProxyService<ServiceWalletBanner>('serviceWalletBanner');
  }

  get serviceApproval(): ServiceApproval {
    return this.getProxyService<ServiceApproval>('serviceApproval');
  }

  get serviceInternalSignAndVerify(): ServiceInternalSignAndVerify {
    return this.getProxyService<ServiceInternalSignAndVerify>(
      'serviceInternalSignAndVerify',
    );
  }

  get serviceHyperliquid(): ServiceHyperliquid {
    return this.getProxyService<ServiceHyperliquid>('serviceHyperliquid');
  }

  get serviceHyperliquidCache(): ServiceHyperliquidCache {
    return this.getProxyService<ServiceHyperliquidCache>(
      'serviceHyperliquidCache',
    );
  }

  get serviceHyperliquidExchange(): ServiceHyperliquidExchange {
    return this.getProxyService<ServiceHyperliquidExchange>(
      'serviceHyperliquidExchange',
    );
  }

  get serviceHyperliquidReferral(): ServiceHyperliquidReferral {
    return this.getProxyService<ServiceHyperliquidReferral>(
      'serviceHyperliquidReferral',
    );
  }

  get serviceHyperliquidWallet(): ServiceHyperliquidWallet {
    return this.getProxyService<ServiceHyperliquidWallet>(
      'serviceHyperliquidWallet',
    );
  }

  get serviceHyperliquidSubscription(): ServiceHyperliquidSubscription {
    return this.getProxyService<ServiceHyperliquidSubscription>(
      'serviceHyperliquidSubscription',
    );
  }

  get serviceWalletStatus(): ServiceWalletStatus {
    return this.getProxyService<ServiceWalletStatus>('serviceWalletStatus');
  }

  get serviceKeylessWallet(): ServiceKeylessWallet {
    return this.getProxyService<ServiceKeylessWallet>('serviceKeylessWallet');
  }

  get serviceIpTable(): ServiceIpTable {
    return this.getProxyService<ServiceIpTable>('serviceIpTable');
  }

  get serviceNetworkDoctor(): ServiceNetworkDoctor {
    return this.getProxyService<ServiceNetworkDoctor>('serviceNetworkDoctor');
  }

  get serviceOneKeyID(): ServiceOneKeyID {
    return this.getProxyService<ServiceOneKeyID>('serviceOneKeyID');
  }

  get serviceRookieGuide(): ServiceRookieGuide {
    return this.getProxyService<ServiceRookieGuide>('serviceRookieGuide');
  }
}

export default BackgroundApiProxy;
