import { analytics } from '../../analytics';
import { isPromiseObject } from '../../utils/promiseUtils';
import { getLoggerExtension } from '../extensions';
import { stringifyFunc } from '../stringifyFunc';
import { Metadata } from '../types';

import type { BaseScene } from './baseScene';
import type { EScopeName, IMethodDecoratorMetadata, IScope } from '../types';

const handleMetadata = ({
  scopeName,
  sceneName,
  metadata,
  prop,
  rawMsg,
  obj,
}: {
  scopeName: string;
  sceneName: string;
  metadata: IMethodDecoratorMetadata;
  prop: string;
  rawMsg: string;
  obj: Metadata;
}) => {
  setTimeout(() => {
    switch (metadata.type) {
      case 'local':
        {
          const extensionName = `${scopeName} -> ${sceneName}`;
          const logger = getLoggerExtension(extensionName);
          const msg = `${scopeName} -> ${sceneName} -> ${prop}: ${rawMsg}`;
          logger[metadata.level](msg);
          if (metadata.level === 'error') {
            console.error(msg);
          }
        }
        break;
      case 'server':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        analytics.trackEvent(prop, obj.args[0]);
        break;
      case 'console':
      default: {
        console[metadata.level](...obj.args);
      }
    }
  });
};

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
                  handleMetadata({
                    scopeName: this.scopeName,
                    sceneName,
                    metadata,
                    prop,
                    rawMsg,
                    obj,
                  });
                }
              } else {
                handleMetadata({
                  scopeName: this.scopeName,
                  sceneName,
                  metadata: obj.metadata,
                  prop,
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
