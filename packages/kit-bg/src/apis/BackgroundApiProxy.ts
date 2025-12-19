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
import type ServiceHyperliquidExchange from '../services/ServiceHyperLiquid/ServiceHyperliquidExchange';
import type ServiceHyperliquidSubscription from '../services/ServiceHyperLiquid/ServiceHyperliquidSubscription';
import type ServiceHyperliquidWallet from '../services/ServiceHyperLiquid/ServiceHyperliquidWallet';
import type ServiceInternalSignAndVerify from '../services/ServiceInternalSignAndVerify';
import type ServiceIpTable from '../services/ServiceIpTable';
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
import type ServicePrime from '../services/ServicePrime';
import type ServicePrimeCloudSync from '../services/ServicePrimeCloudSync';
import type ServicePrimeTransfer from '../services/ServicePrimeTransfer';
// import type ServiceCronJob from './services/ServiceCronJob';
import type ServicePromise from '../services/ServicePromise';
import type ServiceQrWallet from '../services/ServiceQrWallet';
import type ServiceReferralCode from '../services/ServiceReferralCode';
import type ServiceScanQRCode from '../services/ServiceScanQRCode';
import type ServiceSend from '../services/ServiceSend';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceSignature from '../services/ServiceSignature';
import type ServiceSignatureConfirm from '../services/ServiceSignatureConfirm';
import type ServiceSpotlight from '../services/ServiceSpotlight';
import type ServiceStaking from '../services/ServiceStaking';
import type ServiceSwap from '../services/ServiceSwap';
import type ServiceToken from '../services/ServiceToken';
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

  walletConnect = this._createProxyService(
    'walletConnect',
  ) as ProviderApiWalletConnect;

  servicePromise = this._createProxyService('servicePromise') as ServicePromise;

  servicePassword = this._createProxyService(
    'servicePassword',
  ) as ServicePassword;

  serviceWebviewPerp = this._createProxyService(
    'serviceWebviewPerp',
  ) as ServiceWebviewPerp;

  serviceDevSetting = this._createProxyService(
    'serviceDevSetting',
  ) as ServiceDevSetting;

  serviceSetting = this._createProxyService('serviceSetting') as ServiceSetting;

  serviceNetwork = this._createProxyService('serviceNetwork') as ServiceNetwork;

  serviceAccount = this._createProxyService('serviceAccount') as ServiceAccount;

  serviceAccountSelector = this._createProxyService(
    'serviceAccountSelector',
  ) as ServiceAccountSelector;

  serviceApp = this._createProxyService('serviceApp') as ServiceApp;

  serviceSend = this._createProxyService('serviceSend') as ServiceSend;

  serviceSwap = this._createProxyService('serviceSwap') as ServiceSwap;

  serviceToken = this._createProxyService('serviceToken') as ServiceToken;

  serviceNFT = this._createProxyService('serviceNFT') as ServiceNFT;

  serviceAppCleanup = this._createProxyService(
    'serviceAppCleanup',
  ) as ServiceAppCleanup;

  serviceHistory = this._createProxyService('serviceHistory') as ServiceHistory;

  serviceTransaction = this._createProxyService(
    'serviceTransaction',
  ) as ServiceTransaction;

  serviceDeFi = this._createProxyService('serviceDeFi') as ServiceDeFi;

  serviceValidator = this._createProxyService(
    'serviceValidator',
  ) as ServiceValidator;

  serviceScanQRCode = this._createProxyService(
    'serviceScanQRCode',
  ) as ServiceScanQRCode;

  serviceCloudBackup = this._createProxyService(
    'serviceCloudBackup',
  ) as ServiceCloudBackup;

  serviceCloudBackupV2 = this._createProxyService(
    'serviceCloudBackupV2',
  ) as ServiceCloudBackupV2;

  serviceLiteCardMnemonic = this._createProxyService(
    'serviceLiteCardMnemonic',
  ) as ServiceLiteCardMnemonic;

  serviceNameResolver = this._createProxyService(
    'serviceNameResolver',
  ) as ServiceNameResolver;

  serviceGas = this._createProxyService('serviceGas') as ServiceGas;

  serviceDiscovery = this._createProxyService(
    'serviceDiscovery',
  ) as ServiceDiscovery;

  serviceDemo = this._createProxyService('serviceDemo') as ServiceDemo;

  serviceV4Migration = this._createProxyService(
    'serviceV4Migration',
  ) as ServiceV4Migration;

  serviceDApp = this._createProxyService('serviceDApp') as ServiceDApp;

  serviceDappSide = this._createProxyService(
    'serviceDappSide',
  ) as ServiceDappSide;

  serviceWalletConnect = this._createProxyService(
    'serviceWalletConnect',
  ) as ServiceWalletConnect;

  serviceNotification = this._createProxyService(
    'serviceNotification',
  ) as ServiceNotification;

  servicePrime = this._createProxyService('servicePrime') as ServicePrime;

  serviceMasterPassword = this._createProxyService(
    'serviceMasterPassword',
  ) as ServiceMasterPassword;

  servicePrimeCloudSync = this._createProxyService(
    'servicePrimeCloudSync',
  ) as ServicePrimeCloudSync;

  serviceQrWallet = this._createProxyService(
    'serviceQrWallet',
  ) as ServiceQrWallet;

  serviceAccountProfile = this._createProxyService(
    'serviceAccountProfile',
  ) as ServiceAccountProfile;

  serviceFreshAddress = this._createProxyService(
    'serviceFreshAddress',
  ) as ServiceFreshAddress;

  serviceBatchCreateAccount = this._createProxyService(
    'serviceBatchCreateAccount',
  ) as ServiceBatchCreateAccount;

  serviceAllNetwork = this._createProxyService(
    'serviceAllNetwork',
  ) as ServiceAllNetwork;

  serviceOnboarding = this._createProxyService(
    'serviceOnboarding',
  ) as ServiceOnboarding;

  // serviceCronJob = this._createProxyService('serviceCronJob') as ServiceCronJob;

  serviceBootstrap = this._createProxyService(
    'serviceBootstrap',
  ) as ServiceBootstrap;

  serviceHardware = this._createProxyService(
    'serviceHardware',
  ) as ServiceHardware;

  serviceHardwareUI = this._createProxyService(
    'serviceHardwareUI',
  ) as ServiceHardwareUI;

  serviceFirmwareUpdate = this._createProxyService(
    'serviceFirmwareUpdate',
  ) as ServiceFirmwareUpdate;

  serviceAddressBook = this._createProxyService(
    'serviceAddressBook',
  ) as ServiceAddressBook;

  serviceAppUpdate = this._createProxyService(
    'serviceAppUpdate',
  ) as ServiceAppUpdate;

  serviceSpotlight = this._createProxyService(
    'serviceSpotlight',
  ) as ServiceSpotlight;

  serviceMarket = this._createProxyService('serviceMarket') as ServiceMarket;

  serviceMarketV2 = this._createProxyService(
    'serviceMarketV2',
  ) as ServiceMarketV2;

  serviceMarketWS = this._createProxyService(
    'serviceMarketWS',
  ) as ServiceMarketWS;

  serviceE2E = this._createProxyService('serviceE2E') as ServiceE2E;

  serviceLightning = this._createProxyService(
    'serviceLightning',
  ) as ServiceLightning;

  serviceLogger = this._createProxyService('serviceLogger') as ServiceLogger;

  serviceContextMenu = this._createProxyService(
    'serviceContextMenu',
  ) as ServiceContextMenu;

  serviceFiatCrypto = this._createProxyService(
    'serviceFiatCrypto',
  ) as ServiceFiatCrypto;

  serviceSignature = this._createProxyService(
    'serviceSignature',
  ) as ServiceSignature;

  serviceNostr = this._createProxyService('serviceNostr') as ServiceNostr;

  serviceUniversalSearch = this._createProxyService(
    'serviceUniversalSearch',
  ) as ServiceUniversalSearch;

  serviceStaking = this._createProxyService('serviceStaking') as ServiceStaking;

  serviceExplorer = this._createProxyService(
    'serviceExplorer',
  ) as ServiceExplorer;

  serviceCustomToken = this._createProxyService(
    'serviceCustomToken',
  ) as ServiceCustomToken;

  serviceCustomRpc = this._createProxyService(
    'serviceCustomRpc',
  ) as ServiceCustomRpc;

  serviceSignatureConfirm = this._createProxyService(
    'serviceSignatureConfirm',
  ) as ServiceSignatureConfirm;

  serviceReferralCode = this._createProxyService(
    'serviceReferralCode',
  ) as ServiceReferralCode;

  serviceDBBackup = this._createProxyService(
    'serviceDBBackup',
  ) as ServiceDBBackup;

  servicePrimeTransfer = this._createProxyService(
    'servicePrimeTransfer',
  ) as ServicePrimeTransfer;

  serviceWalletBanner = this._createProxyService(
    'serviceWalletBanner',
  ) as ServiceWalletBanner;

  serviceApproval = this._createProxyService(
    'serviceApproval',
  ) as ServiceApproval;

  serviceInternalSignAndVerify = this._createProxyService(
    'serviceInternalSignAndVerify',
  ) as ServiceInternalSignAndVerify;

  serviceHyperliquid = this._createProxyService(
    'serviceHyperliquid',
  ) as ServiceHyperliquid;

  serviceHyperliquidExchange = this._createProxyService(
    'serviceHyperliquidExchange',
  ) as ServiceHyperliquidExchange;

  serviceHyperliquidWallet = this._createProxyService(
    'serviceHyperliquidWallet',
  ) as ServiceHyperliquidWallet;

  serviceHyperliquidSubscription = this._createProxyService(
    'serviceHyperliquidSubscription',
  ) as ServiceHyperliquidSubscription;

  serviceWalletStatus = this._createProxyService(
    'serviceWalletStatus',
  ) as ServiceWalletStatus;

  serviceKeylessWallet = this._createProxyService(
    'serviceKeylessWallet',
  ) as ServiceKeylessWallet;

  serviceIpTable = this._createProxyService('serviceIpTable') as ServiceIpTable;

  serviceNetworkDoctor = this._createProxyService(
    'serviceNetworkDoctor',
  ) as ServiceNetworkDoctor;

  serviceOneKeyID = this._createProxyService(
    'serviceOneKeyID',
  ) as ServiceOneKeyID;
}

export default BackgroundApiProxy;
