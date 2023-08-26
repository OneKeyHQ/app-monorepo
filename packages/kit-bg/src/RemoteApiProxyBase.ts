/* eslint-disable @typescript-eslint/no-unsafe-return,  @typescript-eslint/no-unsafe-member-access */

import { wait } from '@onekeyhq/kit/src/utils/helper';

abstract class RemoteApiProxyBase {
  abstract checkEnvAvailable(): void;

  abstract waitRemoteApiReady(): Promise<void>;

  abstract callRemoteApi(options: {
    module: string;
    method: string;
    params: any[];
  }): Promise<any>;

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
