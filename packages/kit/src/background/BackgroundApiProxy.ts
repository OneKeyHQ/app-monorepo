/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import {
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
} from '@onekeyfe/cross-inpage-provider-types';

import platformEnv, { isExtensionUi } from '@onekeyhq/shared/src/platformEnv';

import { INTERNAL_METHOD_PREFIX } from './decorators';

export interface IBackgroundApiBridge {
  connectBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;
}

export interface IBackgroundApi {
  dispatchAction(action: any): void;
  getStoreState(): Promise<any>;
  // ----------------------------------------------
  changeAccounts(address: string): void;
  changeChain(chainId: string, networkVersion?: string): void;
  notifyAccountsChanged(): void;
  notifyChainChanged(): void;
}

class BackgroundApiProxy implements IBackgroundApi, IBackgroundApiBridge {
  connectBridge(bridge: JsBridgeBase) {
    (this.backgroundApi as IBackgroundApiBridge).connectBridge(bridge);
  }

  bridgeReceiveHandler = (
    payload: IJsBridgeMessagePayload,
  ): any | Promise<any> =>
    (this.backgroundApi as IBackgroundApiBridge).bridgeReceiveHandler(payload);

  constructor({
    backgroundApi,
  }: {
    backgroundApi?: any;
  } = {}) {
    if (backgroundApi) {
      this.backgroundApi = backgroundApi as IBackgroundApi;
    }
  }

  // init in NON-Ext UI env
  private backgroundApi?: IBackgroundApi | IBackgroundApiBridge;

  callBackgroundMethod(
    sync = true,
    method: string,
    ...params: Array<any>
  ): any {
    if (platformEnv.isExtension && isExtensionUi()) {
      const data = {
        method: `${INTERNAL_METHOD_PREFIX}${method}`,
        params,
      };
      if (sync) {
        // call without Promise result
        window.extJsBridgeUiToBg.requestSync({
          data,
        });
      } else {
        return window.extJsBridgeUiToBg.request({
          data,
        });
      }
    } else {
      // @ts-expect-error
      return this.backgroundApi[method].call(this.backgroundApi, ...params);
    }
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(true, method, ...params);
  }

  callBackground(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(false, method, ...params);
  }

  // ----------------------------------------------

  // TODO add custom eslint rule to force method name match
  dispatchAction(action: any) {
    return this.callBackgroundSync('dispatchAction', action);
  }

  getStoreState(): Promise<any> {
    return this.callBackground('getStoreState');
  }

  changeAccounts(address: string): void {
    return this.callBackgroundSync('changeAccounts', address);
  }

  changeChain(chainId: string, networkVersion?: string): void {
    return this.callBackgroundSync('changeChain', chainId, networkVersion);
  }

  notifyAccountsChanged(): void {
    return this.callBackground('notifyAccountsChanged');
  }

  notifyChainChanged(): void {
    return this.callBackground('notifyChainChanged');
  }
}

export default BackgroundApiProxy;
