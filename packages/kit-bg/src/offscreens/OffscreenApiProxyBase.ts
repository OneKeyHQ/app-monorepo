/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { waitForDataLoaded } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { RemoteApiProxyBase } from '../apis/RemoteApiProxyBase';

import { OFFSCREEN_API_MESSAGE_TYPE } from './types';

import type { IOffscreenApiMessagePayload } from '../apis/IBackgroundApi';

export class OffscreenApiProxyBase extends RemoteApiProxyBase {
  override checkEnvAvailable(): void {
    if (!platformEnv.isExtensionBackground) {
      throw new Error(
        'offscreenApiProxy should only be used in extension Background.',
      );
    }
  }

  override async waitRemoteApiReady(): Promise<void> {
    await timerUtils.wait(0);
    const bridge = backgroundApiProxy?.backgroundApi?.bridgeExtBg;
    await waitForDataLoaded({
      data: () => bridge?.offscreenPort,
      wait: 300,
      logName: 'offscreenPort ready check',
      timeout: timerUtils.getTimeDurationMs({ minute: 1 }),
    });
  }

  override callRemoteApi(options: {
    module: string;
    method: string;
    params: any[];
  }): Promise<any> | undefined {
    if (!platformEnv.isManifestV3) {
      return;
    }
    const { module, method, params } = options;
    const message: IOffscreenApiMessagePayload = {
      type: OFFSCREEN_API_MESSAGE_TYPE,
      module: module as any,
      method,
      params,
    };
    const bridge = backgroundApiProxy?.backgroundApi?.bridgeExtBg;
    // TODO move to bridges hub
    return bridge?.requestToOffscreen(message);
  }

  // _moduleCreatedNames: Record<string, boolean> = {};

  // _proxyMethodsCache: Record<string, any> = {};

  // async callOffscreenMethod(key: string, ...args: any[]) {
  //   if (!platformEnv.isManifestV3) {
  //     return;
  //   }
  //   // make this method to promise, so that background won't crash if error occurs
  //   await timerUtils.wait(0);
  //   const bridge = backgroundApiProxy?.backgroundApi?.bridgeExtBg;
  //   await waitForDataLoaded({
  //     data: () => bridge?.offscreenPort,
  //     wait: 300,
  //     logName: 'offscreenPort ready check',
  //     timeout: timerUtils.getTimeDurationMs({ minute: 1 }),
  //   });
  //   const [module, method] = key.split('.');
  //   const message: IOffscreenApiMessagePayload = {
  //     type: OFFSCREEN_API_MESSAGE_TYPE,
  //     module: module as any,
  //     method,
  //     params: args,
  //   };
  //   // TODO move to bridges hub
  //   return bridge?.requestToOffscreen(message);
  // }

  // _createProxyModule(
  //   name = 'ROOT',
  //   customMethods: {
  //     [method: string]: (proxy: typeof Proxy, ...args: any[]) => any;
  //   } = {},
  //   options: {
  //     asyncThenSupport?: boolean;
  //   } = {},
  // ): any {
  //   if (this._moduleCreatedNames[name]) {
  //     throw new Error(`_createProxyService name duplicated. name=${name}`);
  //   }
  //   this._moduleCreatedNames[name] = true;
  //   const proxy: any = new Proxy(
  //     {},
  //     {
  //       get: (target, method) => {
  //         if (typeof method === 'string') {
  //           const key = `${name}.${method}`;
  //           if (options.asyncThenSupport && method === 'then') {
  //             return proxy;
  //           }
  //           if (!this._proxyMethodsCache[key]) {
  //             this._proxyMethodsCache[key] = (...args: any[]) => {
  //               if (customMethods[method]) {
  //                 const result = customMethods[method](proxy, ...args);
  //                 return result;
  //               }
  //               return this.callOffscreenMethod(key, ...args);
  //             };
  //           }
  //           return this._proxyMethodsCache[key];
  //         }
  //         return (target as any)[method];
  //       },
  //     },
  //   );
  //   return proxy;
  // }
}
