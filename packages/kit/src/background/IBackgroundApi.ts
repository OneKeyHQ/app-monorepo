// import type only here to avoid cycle-deps
import {
  IJsBridgeMessagePayload,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';

import type { Engine } from '@onekeyhq/engine';
import type { Validators } from '@onekeyhq/engine/src/validators';

import type { IAppSelector, IPersistor, IStore } from '../store';
import type ProviderApiBase from './providers/ProviderApiBase';
import type WalletConnectAdapter from './providers/WalletConnectAdapter';
import type ServiceAccount from './services/ServiceAccount';
import type ServiceApp from './services/ServiceApp';
import type ServiceCronJob from './services/ServiceCronJob';
import type ServiceDapp from './services/ServiceDapp';
import type ServiceNetwork from './services/ServiceNetwork';
import type ServiceOnboarding from './services/ServiceOnboarding';
import type ServicePromise from './services/ServicePromise';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeReceiveHandler,
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

  providers: Record<string, ProviderApiBase>;
  sendForProvider(providerName: IInjectedProviderNamesStrings): any;
  handleProviderMethods(
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<any>>;
}
export interface IBackgroundApi extends IBackgroundApiBridge {
  engine: Engine;
  validator: Validators;
  walletConnect: WalletConnectAdapter;
  servicePromise: ServicePromise;
  serviceDapp: ServiceDapp;
  serviceAccount: ServiceAccount;
  serviceNetwork: ServiceNetwork;
  serviceApp: ServiceApp;
  serviceCronJob: ServiceCronJob;
  serviceOnboarding: ServiceOnboarding;

  // ----------------------------------------------
  listNetworks(): any;
}

export type IDappCallParams = {
  id: string | number;
  origin: string;
  scope: IInjectedProviderNamesStrings;
  data: string;
};
