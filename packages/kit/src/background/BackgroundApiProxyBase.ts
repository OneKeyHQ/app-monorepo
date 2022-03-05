/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import platformEnv, { isExtensionUi } from '@onekeyhq/shared/src/platformEnv';

import { INTERNAL_METHOD_PREFIX } from './decorators';
import { IBackgroundApi, IBackgroundApiBridge } from './IBackgroundApi';
import { ensureSerializable } from './utils';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export class BackgroundApiProxyBase implements IBackgroundApiBridge {
  bridge = {} as JsBridgeBase;

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
    ensureSerializable(params);
    let [serviceName, methodName] = method.split('.');
    if (!methodName) {
      methodName = serviceName;
      serviceName = '';
    }
    if (serviceName === 'ROOT') {
      serviceName = '';
    }
    if (platformEnv.isExtension && isExtensionUi()) {
      const data = {
        service: serviceName,
        method: `${INTERNAL_METHOD_PREFIX}${methodName}`,
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
      const serviceApi = serviceName
        ? (this.backgroundApi as any)[serviceName]
        : this.backgroundApi;
      return serviceApi[methodName].call(serviceApi, ...params);
    }
  }

  callBackgroundSync(method: string, ...params: Array<any>): any {
    this.callBackgroundMethod(true, method, ...params);
  }

  callBackground(method: string, ...params: Array<any>): any {
    return this.callBackgroundMethod(false, method, ...params);
  }
}
