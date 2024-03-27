import { isPromiseObject } from '../../utils/promiseUtils';
import { getLoggerExtension } from '../extensions';
import { stringifyFunc } from '../stringifyFunc';
import { type EScopeName, type IScope, Metadata } from '../types';

import type { BaseScene } from './baseScene';

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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const result = instance[prop].call(instance, ...args);
          const obj = isPromiseObject(result) ? await result : result;
          if (obj instanceof Metadata) {
            const extensionName = `${this.scopeName}`;
            const logger = getLoggerExtension(extensionName);
            const msg = `${
              this.scopeName
            } -> ${sceneName} -> ${prop}: ${stringifyFunc(...obj.args)}`;
            logger[obj.metadata.level](msg);
            return obj;
          }
          //  eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return obj;
        };
      },
    });
    return NOOP;
  }
}
