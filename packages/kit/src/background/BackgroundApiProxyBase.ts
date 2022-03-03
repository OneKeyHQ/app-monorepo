import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

import platformEnv, { isExtensionUi } from '@onekeyhq/shared/src/platformEnv';

import { INTERNAL_METHOD_PREFIX } from './decorators';
import { IBackgroundApi, IBackgroundApiBridge } from './IBackgroundApi';

export class BackgroundApiProxyBase implements IBackgroundApiBridge {
  connectBridge(bridge: JsBridgeBase) {
    this.backgroundApi?.connectBridge(bridge);
  }

  bridgeReceiveHandler = (
    payload: IJsBridgeMessagePayload,
  ): any | Promise<any> => this.backgroundApi?.bridgeReceiveHandler(payload);

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
  private backgroundApi?: IBackgroundApi;

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
      if (!this.backgroundApi) {
        throw new Error('backgroundApi not found in non-ext env');
      }
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
      return this.backgroundApi[method].call(this.backgroundApi, ...params);
    }
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(true, method, ...params);
  }

  callBackground(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(false, method, ...params);
  }
}
