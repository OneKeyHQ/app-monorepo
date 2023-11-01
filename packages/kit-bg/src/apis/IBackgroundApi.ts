// import type only here to avoid cycle-deps error

import type { IAppSelector, IPersistor, IStore } from '@onekeyhq/kit/src/store';

import type ProviderApiBase from '../providers/ProviderApiBase';
import type ServicePromise from '../services/ServicePromise';
import type { EAtomNames } from '../states/jotai/atomNames';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
  IJsonRpcResponse,
} from '@onekeyfe/cross-inpage-provider-types';
import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

import type ServiceApp from '../services/ServiceApp';
// import type ServiceBootstrap from '../services/ServiceBootstrap';
// import type ServiceCronJob from '../services/ServiceCronJob';

export type IBackgroundApiInternalCallMessage = IJsonRpcRequest & {
  service: string;
};

export interface IBackgroundApiBridge {
  // **** redux
  store: IStore;
  persistor: IPersistor;
  dispatch: (...actions: any[]) => void;
  getState: () => Promise<{ state: any; bootstrapped: boolean }>;
  appSelector: IAppSelector;

  // **** jotai
  setAtomValue: (atomName: EAtomNames, value: any) => Promise<void>;
  getAtomStates: () => Promise<{ states: Record<EAtomNames, any> }>;

  // **** webview bridge
  bridge: JsBridgeBase | null;
  bridgeExtBg: JsBridgeExtBackground | null;
  connectBridge(bridge: JsBridgeBase): void;
  connectWebEmbedBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;

  // **** dapp provider api
  providers: Record<IInjectedProviderNames, ProviderApiBase>;
  sendForProvider(providerName: IInjectedProviderNamesStrings): any;
  handleProviderMethods<T>(
    payload: IJsBridgeMessagePayload,
  ): Promise<IJsonRpcResponse<T>>;
}
export interface IBackgroundApi extends IBackgroundApiBridge {
  // walletConnect: ProviderApiWalletConnect; // TODO move to IBackgroundApiBridge

  // **** services
  servicePromise: ServicePromise;
  serviceApp: ServiceApp;
  // serviceBootstrap: ServiceBootstrap;
  // serviceCronJob: ServiceCronJob;
}
