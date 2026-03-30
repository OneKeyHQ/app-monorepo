import { NO_LOG_OUTPUT } from '../types';

import type { BaseScene } from './baseScene';
import type { IMethodDecoratorMetadata } from '../types';

function createDecorator(decoratorArgs: IMethodDecoratorMetadata) {
  return function logMethod(
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: any[]) => any;
    if (typeof originalMethod !== 'function') {
      return descriptor;
    }
    descriptor.value = function (this: BaseScene, ...args: any[]) {
      try {
        let result = originalMethod.apply(this, args);

        if (!Array.isArray(result)) {
          result = [result];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        result = (result as unknown[]).filter((item) => item !== NO_LOG_OUTPUT);
        if (result.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return result;
        }

        // Emit log directly — no Metadata wrapping, no Proxy needed
        if (this._emitLog) {
          this._emitLog(propertyKey, result, decoratorArgs);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (error) {
        console.error(error);
        return undefined;
      }
    };
    return descriptor;
  };
}

export function LogToLocal(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator({ level: 'info', type: 'local', ...decoratorArgs });
}

export function LogToServer(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator({ level: 'info', type: 'server', ...decoratorArgs });
}

export function LogToConsole(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator({ level: 'info', type: 'console', ...decoratorArgs });
}
