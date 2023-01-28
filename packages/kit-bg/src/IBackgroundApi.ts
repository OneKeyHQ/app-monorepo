// import type only here to avoid cycle-deps error

import type { Engine } from '@onekeyhq/engine';
import type { Validators } from '@onekeyhq/engine/src/validators';
import type { VaultFactory } from '@onekeyhq/engine/src/vaults/VaultFactory';
import type { IAppSelector, IPersistor, IStore } from '@onekeyhq/kit/src/store';

import type ProviderApiBase from './providers/ProviderApiBase';
import type { ProviderApiWalletConnect } from './providers/ProviderApiWalletConnect';
import type ServiceAccount from './services/ServiceAccount';
import type ServiceAccountSelector from './services/ServiceAccountSelector';
import type ServiceApp from './services/ServiceApp';
import type ServiceBatchTransfer from './services/ServiceBatchTransfer';
import type ServiceBootstrap from './services/ServiceBootstrap';
import type ServiceCloudBackup from './services/ServiceCloudBackup';
import type ServiceCronJob from './services/ServiceCronJob';
import type ServiceDapp from './services/ServiceDapp';
import type ServiceDiscover from './services/ServiceDiscover';
import type ServiceExternalAccount from './services/ServiceExternalAccount';
import type ServiceHardware from './services/ServiceHardware';
import type ServiceHistory from './services/ServiceHistory';
import type ServiceHTTP from './services/ServiceHTTP';
import type ServiceMarket from './services/ServiceMarket';
import type ServiceMigrate from './services/ServiceMigrate';
import type ServiceNameResolver from './services/ServiceNameResolver';
import type ServiceNetwork from './services/ServiceNetwork';
import type ServiceNotification from './services/ServiceNotification';
import type ServiceOnboarding from './services/ServiceOnboarding';
import type ServiceOverview from './services/ServiceOverview';
import type ServicePassword from './services/ServicePassword';
import type ServicePrice from './services/ServicePrice';
import type ServicePromise from './services/ServicePromise';
import type ServiceRevoke from './services/ServiceRevoke';
import type ServiceSetting from './services/ServiceSetting';
import type ServiceSocket from './services/ServiceSocket';
import type ServiceSwap from './services/ServiceSwap';
import type ServiceToken from './services/ServiceToken';
import type ServiceTransaction from './services/ServiceTransaction';
import type ServiceTranslation from './services/ServiceTranslation';
import type ServiceWalletConnect from './services/ServiceWalletConnect';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';

export interface IBackgroundApiBridge {
  bridge: JsBridgeBase | null;
  connectBridge(bridge: JsBridgeBase): void;
  connectWebEmbedBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;

  store: IStore;
  persistor: IPersistor;
  dispatch: (...actions: any[]) => void;
  getState: () => Promise<{ state: any; bootstrapped: boolean }>;
  appSelector: IAppSelector;

  providers: Record<IInjectedProviderNames, ProviderApiBase>;
  sendForProvider(providerName: IInjectedProviderNamesStrings): any;
  handleProviderMethods<T>(
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<T>>;
}
export interface IBackgroundApi extends IBackgroundApiBridge {
  engine: Engine;
  validator: Validators;
  vaultFactory: VaultFactory;
  walletConnect: ProviderApiWalletConnect;
  servicePromise: ServicePromise;
  serviceDapp: ServiceDapp;
  serviceAccount: ServiceAccount;
  serviceExternalAccount: ServiceExternalAccount;
  serviceNetwork: ServiceNetwork;
  serviceApp: ServiceApp;
  serviceAccountSelector: ServiceAccountSelector;
  serviceCronJob: ServiceCronJob;
  serviceOnboarding: ServiceOnboarding;
  serviceToken: ServiceToken;
  serviceWalletConnect: ServiceWalletConnect;
  serviceHistory: ServiceHistory;
  serviceHardware: ServiceHardware;
  servicePassword: ServicePassword;
  serviceCloudBackup: ServiceCloudBackup;
  serviceNotification: ServiceNotification;
  serviceSocket: ServiceSocket;
  serviceBootstrap: ServiceBootstrap;
  serviceRevoke: ServiceRevoke;
  serviceNameResolver: ServiceNameResolver;
  serviceMarket: ServiceMarket;
  serviceSetting: ServiceSetting;
  serviceBatchTransfer: ServiceBatchTransfer;
  serviceTransaction: ServiceTransaction;
  servicePrice: ServicePrice;
  serviceSwap: ServiceSwap;
  serviceOverview: ServiceOverview;
  serviceTranslation: ServiceTranslation;
  serviceDiscover: ServiceDiscover;
  serviceMigrate: ServiceMigrate;
  serviceHTTP: ServiceHTTP;
}
