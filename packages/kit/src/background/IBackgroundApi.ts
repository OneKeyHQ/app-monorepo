import type { Engine } from '@onekeyhq/engine';

import type PromiseContainer from './PromiseContainer';
import type DappService from './service/DappService';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeReceiveHandler,
} from '@onekeyfe/cross-inpage-provider-types';

export interface IBackgroundApiBridge {
  bridge: JsBridgeBase | null;
  connectBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;
}
export interface IBackgroundApi extends IBackgroundApiBridge {
  engine: Engine;
  promiseContainer: PromiseContainer;
  dappService: DappService;

  dispatchAction(action: any): void;

  getStoreState(): Promise<any>;

  // ----------------------------------------------
  changeAccounts(address: string): void;

  changeChain(chainId: string, networkVersion?: string): void;

  notifyAccountsChanged(): void;

  notifyChainChanged(): void;

  listNetworks(): any;
}

export type IDappCallParams = {
  id: string | number;
  origin: string;
  scope: IInjectedProviderNamesStrings;
  data: string;
};
