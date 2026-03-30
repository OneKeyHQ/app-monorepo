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
      // Detect whether this is the outermost decorator in a stacked chain.
      // The outermost wrapper is responsible for the single _emitLog call.
      const isOutermost = !this._currentCallMetadata;
      if (isOutermost) {
        this._currentCallMetadata = [];
      }

      try {
        let result = originalMethod.apply(this, args);

        // Inner decorator error → propagate skip to outer
        if (result === undefined) {
          if (isOutermost) {
            this._currentCallMetadata = undefined;
          }
          return undefined;
        }

        if (!Array.isArray(result)) {
          result = [result];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        result = (result as unknown[]).filter((item) => item !== NO_LOG_OUTPUT);
        if (result.length === 0) {
          if (isOutermost) {
            this._currentCallMetadata = undefined;
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return result;
        }

        // Collect metadata — actual emit deferred to outermost wrapper
        this._currentCallMetadata!.push(decoratorArgs);

        if (isOutermost) {
          const metadataList = this._currentCallMetadata!;
          this._currentCallMetadata = undefined;
          if (this._emitLog) {
            this._emitLog(propertyKey, result, metadataList);
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (error) {
        if (isOutermost) {
          this._currentCallMetadata = undefined;
        }
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
