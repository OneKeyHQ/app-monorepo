import type {
  PromiseContainerCallbackCreate,
  PromiseContainerReject,
  PromiseContainerResolve,
} from './PromiseContainer';
import type DappService from './service/DappService';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeReceiveHandler,
} from '@onekeyfe/cross-inpage-provider-types';

export interface IBackgroundApiBridge {
  connectBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;
  bridge?: JsBridgeBase | null;
}
export interface IBackgroundApi extends IBackgroundApiBridge {
  dappService?: DappService;

  dispatchAction(action: any): void;

  getStoreState(): Promise<any>;

  createPromiseCallback(params: PromiseContainerCallbackCreate): number;
  resolvePromiseCallback(params: PromiseContainerResolve): void;
  rejectPromiseCallback(params: PromiseContainerReject): void;

  // ----------------------------------------------
  changeAccounts(address: string): void;

  changeChain(chainId: string, networkVersion?: string): void;

  notifyAccountsChanged(): void;

  notifyChainChanged(): void;
}

export type IDappCallParams = {
  id: string | number;
  origin: string;
  scope: IInjectedProviderNamesStrings;
  data: string;
};
