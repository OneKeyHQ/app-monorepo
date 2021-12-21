/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import JsBridgeBase from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeBase';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/inpage-provider/src/provider/decorators';
import {
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
} from '@onekeyhq/inpage-provider/src/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export interface BackgroundApiBridge {
  connectBridge(bridge: JsBridgeBase): void;
  bridgeReceiveHandler: IJsBridgeReceiveHandler;
}

export interface IBackgroundApi {
  changeAccounts(address: string): void;
  changeChain(chainId: string): void;
}

class BackgroundApiProxy implements IBackgroundApi, BackgroundApiBridge {
  connectBridge(bridge: JsBridgeBase) {
    (this.backgroundApi as BackgroundApiBridge)?.connectBridge(bridge);
  }

  bridgeReceiveHandler = (
    payload: IJsBridgeMessagePayload,
  ): any | Promise<any> =>
    (this.backgroundApi as BackgroundApiBridge)?.bridgeReceiveHandler(payload);

  constructor({
    getBackgroundApiAsync,
  }: {
    getBackgroundApiAsync?: () => Promise<IBackgroundApi>;
  } = {}) {
    if (getBackgroundApiAsync) {
      getBackgroundApiAsync().then(
        (backgroundApi) => (this.backgroundApi = backgroundApi),
      );
    }
  }

  // init in NON-Ext UI env
  private backgroundApi?: IBackgroundApi | BackgroundApiBridge;

  callBackground(method: string, ...params: Array<any>): any {
    const isExtensionUi = true; // Mock
    if (platformEnv.isExtension && isExtensionUi) {
      // TODO request, requestSync
      window.extJsBridgeUiToBg.requestSync({
        data: {
          method: `${INTERNAL_METHOD_PREFIX}${method}`,
          params,
        },
      });
    } else {
      // @ts-expect-error
      return this.backgroundApi[method].call(this.backgroundApi, ...params);
    }
  }

  // ----------------------------------------------

  changeAccounts(address: string): void {
    return this.callBackground('changeAccounts', address);
  }

  changeChain(chainId: string): void {
    return this.callBackground('changeChain', chainId);
  }
}

export default BackgroundApiProxy;
