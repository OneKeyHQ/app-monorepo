// import type only here to avoid cycle-deps error

import type ProviderApiBase from '../providers/ProviderApiBase';
import type ServiceApp from '../services/ServiceApp';
import type ServiceDiscovery from '../services/ServiceDiscovery';
import type ServicePassword from '../services/ServicePassword';
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

// import type ServiceBootstrap from '../services/ServiceBootstrap';
// import type ServiceCronJob from '../services/ServiceCronJob';

export type IBackgroundApiInternalCallMessage = IJsonRpcRequest & {
  service: string;
};

export interface IBackgroundApiBridge {
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
  servicePassword: ServicePassword;
  serviceApp: ServiceApp;
  serviceDiscovery: ServiceDiscovery;
  // serviceBootstrap: ServiceBootstrap;
  // serviceCronJob: ServiceCronJob;
}
