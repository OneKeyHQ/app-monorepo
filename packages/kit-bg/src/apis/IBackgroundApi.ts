// import type only here to avoid cycle-deps error

import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { SimpleDb } from '../dbs/simple/base/SimpleDb';
import type ProviderApiBase from '../providers/ProviderApiBase';
import type { ProviderApiWalletConnect } from '../providers/ProviderApiWalletConnect';
import type ServiceAccount from '../services/ServiceAccount';
import type ServiceAccountProfile from '../services/ServiceAccountProfile';
import type ServiceAddressBook from '../services/ServiceAddressBook';
import type ServiceApp from '../services/ServiceApp';
import type ServiceBootstrap from '../services/ServiceBootstrap';
import type ServiceDApp from '../services/ServiceDApp';
import type ServiceDefi from '../services/ServiceDefi';
import type ServiceDiscovery from '../services/ServiceDiscovery';
import type ServiceGas from '../services/ServiceGas';
import type ServiceHardware from '../services/ServiceHardware';
import type ServiceHistory from '../services/ServiceHistory';
import type ServiceNameResolver from '../services/ServiceNameResolver';
import type ServiceNetwork from '../services/ServiceNetwork';
import type ServiceNFT from '../services/ServiceNFT';
import type ServiceOnboarding from '../services/ServiceOnboarding';
import type ServicePassword from '../services/ServicePassword';
import type ServicePromise from '../services/ServicePromise';
import type ServiceScanQRCode from '../services/ServiceScanQRCode';
import type ServiceSend from '../services/ServiceSend';
import type ServiceSetting from '../services/ServiceSetting';
import type ServiceSwap from '../services/ServiceSwap';
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
  simpleDb: SimpleDb;

  // **** WalletConnect
  walletConnect: ProviderApiWalletConnect;

  // **** services
  servicePromise: ServicePromise;
  servicePassword: ServicePassword;
  serviceSetting: ServiceSetting;
  serviceApp: ServiceApp;
  serviceSend: ServiceSend;
  serviceSwap: ServiceSwap;
  serviceBootstrap: ServiceBootstrap;
  serviceNetwork: ServiceNetwork;
  serviceAccount: ServiceAccount;
  serviceToken: ServiceToken;
  serviceNFT: ServiceNFT;
  serviceHistory: ServiceHistory;
  serviceDefi: ServiceDefi;
  serviceValidator: ServiceValidator;
  serviceNameResolver: ServiceNameResolver;
  serviceGas: ServiceGas;
  serviceDiscovery: ServiceDiscovery;
  serviceDApp: ServiceDApp;
  serviceAccountProfile: ServiceAccountProfile;
  serviceHardware: ServiceHardware;

  serviceOnboarding: ServiceOnboarding;
  serviceScanQRCode: ServiceScanQRCode;
  serviceAddressBook: ServiceAddressBook;
}
