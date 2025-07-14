/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-unsafe-return,  @typescript-eslint/no-unsafe-member-access */

import { isMethodAllowed } from '../decorators/e2eeApiMethod';

import type { IRoomManagerContext } from '../roomManager';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

export function buildCallRemoteApiMethod<T extends IJsonRpcRequest>(
  moduleGetter: (module: any) => Promise<any>,
  remoteApiType: 'e2eeServerApi',
  context: IRoomManagerContext,
) {
  return async function callRemoteApiMethod(message: T) {
    const { method, params = [] } = message;
    // @ts-ignore
    const module = message?.module as any;
    if (!module) {
      throw new Error('callRemoteApiMethod ERROR: module is required');
    }
    const moduleInstance: any = await moduleGetter(module);
    if (moduleInstance && moduleInstance[method]) {
      // Check if the method is allowed via the whitelist
      if (!isMethodAllowed(moduleInstance, method)) {
        throw new Error(
          `Method ${method} is not allowed. Use @e2eeApiMethod() decorator to whitelist it.`,
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = await moduleInstance[method](
        // @ts-ignore
        ...[].concat(params as any[]),
        context,
      );
      return result;
    }

    const errorMessage = `callRemoteApiMethod not found: ${remoteApiType}.${
      module as string
    }.${method}() `;

    throw new Error(errorMessage);
  };
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// used for offscreenApi and webEmbedApi
abstract class RemoteApiProxyBase {
  abstract checkEnvAvailable(): void;

  abstract waitRemoteApiReady(): Promise<void>;

  protected abstract callRemoteApi(options: {
    module: string;
    method: string;
    params: any[];
  }): Promise<any> | undefined;

  _moduleCreatedNames: Record<string, boolean> = {};

  _proxyMethodsCache: Record<string, any> = {};

  async callRemoteMethod(key: string, ...params: any[]) {
    this.checkEnvAvailable();
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await this.checkEnvAvailable();

    // make this method to promise, so that background won't crash if error occurs
    await wait(0);

    await this.waitRemoteApiReady();

    const [module, method] = key.split('.');

    return this.callRemoteApi({
      module,
      method,
      params,
    });
  }

  _createProxyModule<T>(
    name: T | 'ROOT' = 'ROOT',
    customMethods: {
      [method: string]: (proxy: typeof Proxy, ...args: any[]) => any;
    } = {},
    options: {
      asyncThenSupport?: boolean;
    } = {},
  ): any {
    const nameStr = name as string;
    if (this._moduleCreatedNames[nameStr]) {
      throw new Error(`_createProxyService name duplicated. name=${nameStr}`);
    }
    this._moduleCreatedNames[nameStr] = true;
    const proxy: any = new Proxy(
      {},
      {
        get: (target, method) => {
          if (typeof method === 'string') {
            const key = `${nameStr}.${method}`;
            if (options.asyncThenSupport && method === 'then') {
              return proxy;
            }
            if (!this._proxyMethodsCache[key]) {
              this._proxyMethodsCache[key] = (...args: any[]) => {
                if (customMethods[method]) {
                  const result = customMethods[method](proxy, ...args);
                  return result;
                }
                return this.callRemoteMethod(key, ...args);
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

export { RemoteApiProxyBase };
