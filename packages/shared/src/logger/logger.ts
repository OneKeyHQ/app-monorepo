import appGlobals from '../appGlobals';

import { createLoggerScope, getLoggerScopeKeys } from './loggerRegistry';

import type { ILoggerScopeKey, ILoggerScopeMap } from './loggerRegistry';

class DefaultLoggerContainer {
  private _cache = new Map<ILoggerScopeKey, unknown>();

  getScope<K extends ILoggerScopeKey>(key: K): ILoggerScopeMap[K] {
    let instance = this._cache.get(key) as ILoggerScopeMap[K] | undefined;
    if (!instance) {
      instance = createLoggerScope(key);
      this._cache.set(key, instance);
    }
    return instance;
  }
}

export type IDefaultLogger = DefaultLoggerContainer & ILoggerScopeMap;

for (const key of getLoggerScopeKeys()) {
  Object.defineProperty(DefaultLoggerContainer.prototype, key, {
    configurable: true,
    enumerable: true,
    get(this: DefaultLoggerContainer) {
      return this.getScope(key);
    },
  });
}

const defaultLogger = new DefaultLoggerContainer() as IDefaultLogger;
appGlobals.$defaultLogger = defaultLogger;

export { defaultLogger };
