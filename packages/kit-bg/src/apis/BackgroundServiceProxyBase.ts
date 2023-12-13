/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

export abstract class BackgroundServiceProxyBase {
  abstract serviceNameSpace: string;

  abstract callBackground(method: string, ...params: Array<any>): any;

  _serviceCreatedNames = {} as any;

  _proxyServiceCache = {} as any;

  _createProxyService(serviceName = 'ROOT') {
    if (this._serviceCreatedNames[serviceName]) {
      throw new Error(
        `_createProxyService name duplicated. name=${serviceName}`,
      );
    }
    this._serviceCreatedNames[serviceName] = true;
    const NOOP = new Proxy(
      {},
      {
        get: (target, serviceMethod) => {
          if (typeof serviceMethod === 'string') {
            const key = this.serviceNameSpace
              ? `${this.serviceNameSpace}@${serviceName}.${serviceMethod}`
              : `${serviceName}.${serviceMethod}`;
            if (!this._proxyServiceCache[key]) {
              this._proxyServiceCache[key] = (...args: any) => {
                if (!['serviceApp.addLogger'].includes(key)) {
                  // debugLogger.backgroundApi.info('Proxy method call', key);
                }
                return this.callBackground(key, ...args);
              };
            }
            return this._proxyServiceCache[key];
          }
          return (target as any)[serviceMethod];
        },
      },
    );
    return NOOP;
  }
}
