/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getTimeDurationMs, wait } from '@onekeyhq/kit/src/utils/helper';
import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OFFSCREEN_API_MESSAGE_TYPE } from './types';

import type { IOffscreenApiMessagePayload } from './types';

export class OffscreenApiProxyBase {
  constructor() {
    if (!platformEnv.isExtensionBackground) {
      throw new Error(
        'offscreenApiProxy should only be used in extension Background.',
      );
    }
  }

  _moduleCreatedNames: Record<string, boolean> = {};

  _proxyMethodsCache: Record<string, any> = {};

  async callOffscreenMethod(key: string, ...args: any[]) {
    if (!platformEnv.isManifestV3) {
      return;
    }
    // make this method to promise, so that background won't crash if error occurs
    await wait(0);
    const bridge = backgroundApiProxy?.backgroundApi?.bridgeExtBg;
    await waitForDataLoaded({
      data: () => bridge?.offscreenPort,
      wait: 300,
      logName: 'offscreenPort ready check',
      timeout: getTimeDurationMs({ minute: 1 }),
    });
    const [module, method] = key.split('.');
    const message: IOffscreenApiMessagePayload = {
      type: OFFSCREEN_API_MESSAGE_TYPE,
      module: module as any,
      method,
      params: args,
    };
    // TODO move to bridges hub
    return bridge?.requestToOffscreen(message);
  }

  _createProxyModule(
    name = 'ROOT',
    customMethods: {
      [method: string]: (proxy: typeof Proxy, ...args: any[]) => any;
    } = {},
    options: {
      asyncThenSupport?: boolean;
    } = {},
  ): any {
    if (this._moduleCreatedNames[name]) {
      throw new Error(`_createProxyService name duplicated. name=${name}`);
    }
    this._moduleCreatedNames[name] = true;
    const proxy: any = new Proxy(
      {},
      {
        get: (target, method) => {
          if (typeof method === 'string') {
            const key = `${name}.${method}`;
            if (options.asyncThenSupport && method === 'then') {
              return proxy;
            }
            if (!this._proxyMethodsCache[key]) {
              this._proxyMethodsCache[key] = (...args: any[]) => {
                if (customMethods[method]) {
                  const result = customMethods[method](proxy, ...args);
                  return result;
                }
                return this.callOffscreenMethod(key, ...args);
              };
            }
            return this._proxyMethodsCache[key];
          }
          return (target as any)[method];
        },
      },
    );
    return proxy;
  }
}
