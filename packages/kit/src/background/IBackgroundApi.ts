// import type only here to avoid cycle-deps error

import type { Engine } from '@onekeyhq/engine';
import type { Validators } from '@onekeyhq/engine/src/validators';
import type { VaultFactory } from '@onekeyhq/engine/src/vaults/VaultFactory';

import type { IAppSelector, IPersistor, IStore } from '../store';
import type ProviderApiBase from './providers/ProviderApiBase';
import type WalletConnectAdapter from './providers/WalletConnectAdapter';
import type ServiceAccount from './services/ServiceAccount';
import type ServiceApp from './services/ServiceApp';
import type ServiceCloudBackup from './services/ServiceCloudBackup';
import type ServiceCronJob from './services/ServiceCronJob';
import type ServiceDapp from './services/ServiceDapp';
import type ServiceHardware from './services/ServiceHardware';
import type ServiceHistory from './services/ServiceHistory';
import type ServiceNetwork from './services/ServiceNetwork';
import type ServiceOnboarding from './services/ServiceOnboarding';
import type ServicePassword from './services/ServicePassword';
import type ServicePromise from './services/ServicePromise';
import type ServiceToken from './services/ServiceToken';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';

export interface IBackgroundApiBridge {
  bridge: JsBridgeBase | null;
  connectBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;

  store: IStore;
  persistor: IPersistor;
  dispatch: (action: any) => void;
  getState: () => Promise<{ state: any; bootstrapped: boolean }>;
  appSelector: IAppSelector;

  providers: Record<IInjectedProviderNames, ProviderApiBase>;
  sendForProvider(providerName: IInjectedProviderNamesStrings): any;
  handleProviderMethods(
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<any>>;
}
export interface IBackgroundApi extends IBackgroundApiBridge {
  engine: Engine;
  validator: Validators;
  vaultFactory: VaultFactory;
  walletConnect: WalletConnectAdapter;
  servicePromise: ServicePromise;
  serviceDapp: ServiceDapp;
  serviceAccount: ServiceAccount;
  serviceNetwork: ServiceNetwork;
  serviceApp: ServiceApp;
  serviceCronJob: ServiceCronJob;
  serviceOnboarding: ServiceOnboarding;
  serviceToken: ServiceToken;
  serviceHistory: ServiceHistory;
  serviceHardware: ServiceHardware;
  servicePassword: ServicePassword;
  serviceCloudBackup: ServiceCloudBackup;
}

export type IDappSourceInfo = {
  id: string | number; // ServicePromise callback id to reject/resolve
  origin: string;
  scope: IInjectedProviderNamesStrings;
  data: IJsonRpcRequest;
};
