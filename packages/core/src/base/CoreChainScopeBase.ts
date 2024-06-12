import { isString } from 'lodash';

// import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';

import {
  ensurePromiseObject,
  ensureSerializable,
} from '@onekeyhq/shared/src/utils/assertUtils';
import { isPromiseObject } from '@onekeyhq/shared/src/utils/promiseUtils';

import type { CoreChainApiBase } from './CoreChainApiBase';

export abstract class CoreChainScopeBase {
  scopeName = '';

  abstract impl: string;

  abstract hd: CoreChainApiBase;

  protected abstract _hd: () => Promise<typeof CoreChainApiBase>;

  abstract imported: CoreChainApiBase;

  protected abstract _imported: () => Promise<typeof CoreChainApiBase>;

  // **** hardware cannot run in webview, so we don't need to implement it
  // abstract hardware: CoreChainApiBase;
  // protected abstract _hardware: () => Promise<typeof CoreChainApiBase>;

  private apiProxyCache: {
    [apiName: string]: any;
  } = {};

  protected _createApiProxy(apiName: string) {
    if (this.apiProxyCache[apiName] !== undefined) {
      throw new Error(
        `CoreChainScopeBase _createApiProxy ERROR, apiName already defined: ${apiName}`,
      );
    }
    this.apiProxyCache[apiName] = null;
    const NOOP = new Proxy(
      {},
      {
        get:
          (target, prop) =>
          async (...args: any[]) => {
            // console.log(target, prop, args, others, this.scopeName, name);
            const method = prop;
            if (!isString(method)) {
              throw new Error('FlowLogger api method must be string');
            }
            let apiInstance = this.apiProxyCache[apiName];
            if (!apiInstance) {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              const apiClass = await this[`_${apiName}`]();
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, new-cap
              apiInstance = new apiClass();
            }
            this.apiProxyCache[apiName] = apiInstance;
            // flowLogger.app.apiCalls.callCoreApi({
            //   scopeName: this.scopeName,
            //   apiName,
            //   method,
            //   params: args,
            // });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (!apiInstance || !apiInstance[method]) {
              throw new Error(
                `coreApi method not defined: coreChainApi.${this.scopeName}.${apiName}.${method}`,
              );
            }

            // stc signTransaction not support yet
            // ensureSerializable(args);

            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            let result = apiInstance[method](...args);
            ensurePromiseObject(result, {
              serviceName: `${this.scopeName}.${apiName}`,
              methodName: method,
            });
            if (isPromiseObject(result)) {
              result = await result;
            }
            ensureSerializable(result);
            return result as unknown;
          },
      },
    );
    return NOOP;
  }
}
