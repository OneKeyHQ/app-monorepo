import { isPromiseObject } from '../../utils/promiseUtils';
import { stringifyFunc } from '../stringifyFunc';
import { Metadata } from '../types';

import { logFn } from './logFn';

import type { BaseScene } from './baseScene';
import type { EScopeName, IScope } from '../types';

export abstract class BaseScope implements IScope {
  protected abstract scopeName: EScopeName;

  private cache: Record<string, any> = {};

  getName(): EScopeName {
    return this.scopeName;
  }

  createScene<T extends BaseScene>(
    sceneName: string,
    SceneClass: new () => T,
  ): T {
    const NOOP = new Proxy({} as T, {
      get: (target, prop) => {
        const instance =
          this.cache[sceneName] || (this.cache[sceneName] = new SceneClass());
        if (typeof prop !== 'string') {
          throw new Error('Scene method must be string');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!(prop in instance) || typeof instance[prop] !== 'function') {
          throw new Error(`Scene method ${prop} not found`);
        }
        return async (...args: any[]) => {
          let result: any;
          let obj: any;
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            result = instance[prop].call(instance, ...args);
            obj = isPromiseObject(result) ? await result : result;
          } catch (error) {
            console.error(error);
          }
          setTimeout(() => {
            if (obj && obj instanceof Metadata) {
              const rawMsg = stringifyFunc(...obj.args);
              if (Array.isArray(obj.metadata)) {
                for (let i = 0; i < obj.metadata.length; i += 1) {
                  const metadata = obj.metadata[i];
                  logFn({
                    scopeName: this.scopeName,
                    sceneName,
                    metadata,
                    methodName: prop,
                    rawMsg,
                    obj,
                  });
                }
              } else {
                logFn({
                  scopeName: this.scopeName,
                  sceneName,
                  metadata: obj.metadata,
                  methodName: prop,
                  rawMsg,
                  obj,
                });
              }
            }
          });
          //  eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return obj;
        };
      },
    });
    return NOOP;
  }
}
