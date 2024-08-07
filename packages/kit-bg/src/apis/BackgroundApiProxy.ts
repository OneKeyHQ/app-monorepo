/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

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
import type ServiceAppUpdate from '../services/ServiceAppUpdate';
import type ServiceBatchCreateAccount from '../services/ServiceBatchCreateAccount';
import type ServiceBootstrap from '../services/ServiceBootstrap';
import type ServiceCloudBackup from '../services/ServiceCloudBackup';
import type ServiceContextMenu from '../services/ServiceContextMenu';
import type ServiceCustomRpc from '../services/ServiceCustomRpc';
import type ServiceCustomToken from '../services/ServiceCustomToken';
import type ServiceDApp from '../services/ServiceDApp';
import type ServiceDappSide from '../services/ServiceDappSide';
import type ServiceDefi from '../services/ServiceDefi';
import type ServiceDemo from '../services/ServiceDemo';
import type ServiceDevSetting from '../services/ServiceDevSetting';
import type ServiceDiscovery from '../services/ServiceDiscovery';
import type ServiceE2E from '../services/ServiceE2E';
import type ServiceExplorer from '../services/ServiceExplorer';
import type ServiceFiatCrypto from '../services/ServiceFiatCrypto';
import type ServiceFirmwareUpdate from '../services/ServiceFirmwareUpdate';
import type ServiceGas from '../services/ServiceGas';
import type ServiceHardware from '../services/ServiceHardware';
import type ServiceHardwareUI from '../services/ServiceHardwareUI';
import type ServiceHistory from '../services/ServiceHistory';
import type ServiceLightning from '../services/ServiceLightning';
import type ServiceLiteCardMnemonic from '../services/ServiceLiteCardMnemonic';
import type ServiceLogger from '../services/ServiceLogger';
import type ServiceMarket from '../services/ServiceMarket';
import type ServiceNameResolver from '../services/ServiceNameResolver';
import type ServiceNetwork from '../services/ServiceNetwork';
import type ServiceNFT from '../services/ServiceNFT';
import type ServiceNostr from '../services/ServiceNostr';
import type ServiceOnboarding from '../services/ServiceOnboarding';
import type ServicePassword from '../services/ServicePassword';
// import type ServiceCronJob from './services/ServiceCronJob';
import type ServicePromise from '../services/ServicePromise';
import type ServiceQrWallet from '../services/ServiceQrWallet';
import type ServiceScanQRCode from '../services/ServiceScanQRCode';
import type ServiceSend from '../services/ServiceSend';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceSignature from '../services/ServiceSignature';
import type ServiceSpotlight from '../services/ServiceSpotlight';
import type ServiceStaking from '../services/ServiceStaking';
import type ServiceSwap from '../services/ServiceSwap';
import type ServiceToken from '../services/ServiceToken';
import type ServiceUniversalSearch from '../services/ServiceUniversalSearch';
import type ServiceV4Migration from '../services/ServiceV4Migration';
import type ServiceValidator from '../services/ServiceValidator';
import type ServiceWalletConnect from '../services/ServiceWalletConnect';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  simpleDb = new SimpleDbProxy(this);

  walletConnect = this._createProxyService(
    'walletConnect',
  ) as ProviderApiWalletConnect;

  servicePromise = this._createProxyService('servicePromise') as ServicePromise;

  servicePassword = this._createProxyService(
    'servicePassword',
  ) as ServicePassword;

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

  serviceHistory = this._createProxyService('serviceHistory') as ServiceHistory;

  serviceDefi = this._createProxyService('serviceDefi') as ServiceDefi;

  serviceValidator = this._createProxyService(
    'serviceValidator',
  ) as ServiceValidator;

  serviceScanQRCode = this._createProxyService(
    'serviceScanQRCode',
  ) as ServiceScanQRCode;

  serviceCloudBackup = this._createProxyService(
    'serviceCloudBackup',
  ) as ServiceCloudBackup;

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

  serviceQrWallet = this._createProxyService(
    'serviceQrWallet',
  ) as ServiceQrWallet;

  serviceAccountProfile = this._createProxyService(
    'serviceAccountProfile',
  ) as ServiceAccountProfile;

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
}

export default BackgroundApiProxy;
