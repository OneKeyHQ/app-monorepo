import { NO_LOG_OUTPUT } from '../types';

import type { BaseScene } from './baseScene';
import type { IMethodDecoratorMetadata } from '../types';

const LOGGER_DECORATOR_WRAPPER = Symbol('LOGGER_DECORATOR_WRAPPER');

function createDecorator(decoratorArgs: IMethodDecoratorMetadata) {
  return function logMethod(
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as ((...args: any[]) => any) & {
      [LOGGER_DECORATOR_WRAPPER]?: boolean;
    };
    if (typeof originalMethod !== 'function') {
      return descriptor;
    }
    const wrappedMethod = function (this: BaseScene, ...args: any[]) {
      const metadataStack =
        this._currentCallMetadataStack || (this._currentCallMetadataStack = []);
      const currentContext = metadataStack[metadataStack.length - 1];
      const shouldReuseContext =
        !!currentContext &&
        currentContext.methodName === propertyKey &&
        currentContext.isCollectingDecorators;
      const callContext = shouldReuseContext
        ? currentContext
        : {
            methodName: propertyKey,
            metadataList: [] as IMethodDecoratorMetadata[],
            isCollectingDecorators: true,
          };

      if (!shouldReuseContext) {
        metadataStack.push(callContext);
      }

      if (!originalMethod[LOGGER_DECORATOR_WRAPPER]) {
        callContext.isCollectingDecorators = false;
      }

      const cleanupContext = () => {
        if (!shouldReuseContext) {
          metadataStack.pop();
        }
        if (metadataStack.length === 0) {
          this._currentCallMetadataStack = undefined;
        }
      };

      try {
        let result = originalMethod.apply(this, args);

        // Inner decorator error → propagate skip to outer
        if (result === undefined) {
          cleanupContext();
          return undefined;
        }

        if (!Array.isArray(result)) {
          result = [result];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        result = (result as unknown[]).filter((item) => item !== NO_LOG_OUTPUT);
        if (result.length === 0) {
          cleanupContext();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return result;
        }

        // Collect metadata — actual emit deferred to outermost wrapper
        callContext.metadataList.push(decoratorArgs);

        if (!shouldReuseContext) {
          cleanupContext();
          if (this._emitLog) {
            this._emitLog(propertyKey, result, callContext.metadataList);
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (error) {
        cleanupContext();
        console.error(error);
        return undefined;
      }
    };
    wrappedMethod[LOGGER_DECORATOR_WRAPPER] = true;
    descriptor.value = wrappedMethod;
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
