// import type only here to avoid cycle-deps error

import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { SimpleDb } from '../dbs/simple/base/SimpleDb';
import type ProviderApiBase from '../providers/ProviderApiBase';
import type ServiceAccount from '../services/ServiceAccount';
import type ServiceApp from '../services/ServiceApp';
import type ServiceBootstrap from '../services/ServiceBootstrap';
import type ServiceDefi from '../services/ServiceDefi';
import type ServiceDiscovery from '../services/ServiceDiscovery';
import type ServiceGas from '../services/ServiceGas';
import type ServiceHistory from '../services/ServiceHistory';
import type ServiceNameResolver from '../services/ServiceNameResolver';
import type ServiceNFT from '../services/ServiceNFT';
import type ServicePassword from '../services/ServicePassword';
import type ServicePromise from '../services/ServicePromise';
import type ServiceSend from '../services/ServiceSend';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceToken from '../services/ServiceToken';
import type ServiceValidator from '../services/ServiceValidator';
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
// import type ServiceCronJob from '../services/ServiceCronJob';

export type IBackgroundApiInternalCallMessage = IJsonRpcRequest & {
  service: string;
};

export interface IBackgroundApiBridge {
  // **** jotai
  setAtomValue: (atomName: EAtomNames, value: any) => Promise<void>;
  getAtomStates: () => Promise<{ states: Record<EAtomNames, any> }>;

  // **** eventBus
  emitEvent<T extends EAppEventBusNames>(
    type: T,
    payload: IAppEventBusPayload[T],
  ): Promise<boolean>;

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

  simpleDb: SimpleDb;

  // **** services
  servicePromise: ServicePromise;
  servicePassword: ServicePassword;
  serviceSetting: ServiceSetting;
  serviceApp: ServiceApp;
  serviceDiscovery: ServiceDiscovery;
  serviceSend: ServiceSend;
  serviceBootstrap: ServiceBootstrap;
  serviceAccount: ServiceAccount;
  serviceToken: ServiceToken;
  serviceNFT: ServiceNFT;
  serviceHistory: ServiceHistory;
  serviceDefi: ServiceDefi;
  serviceValidator: ServiceValidator;
  serviceNameResolver: ServiceNameResolver;
  serviceGas: ServiceGas;
}
