import type {
  PromiseContainerCallbackCreate,
  PromiseContainerReject,
  PromiseContainerResolve,
} from './PromiseContainer';
import type PromiseContainer from './PromiseContainer';
import type WalletApi from './WalletApi';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeReceiveHandler,
} from '@onekeyfe/cross-inpage-provider-types';

export interface IBackgroundApiBridge {
  connectBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;
  walletApi?: WalletApi;
  bridge?: JsBridgeBase | null;
  promiseContainer?: PromiseContainer;
}
export interface IBackgroundApi extends IBackgroundApiBridge {
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
