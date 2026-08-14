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
      const wrapsAnotherDecorator = !!originalMethod[LOGGER_DECORATOR_WRAPPER];

      if (
        decoratorArgs.devOnly &&
        process.env.NODE_ENV === 'production' &&
        !wrapsAnotherDecorator &&
        !shouldReuseContext
      ) {
        return undefined;
      }
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

      if (!wrapsAnotherDecorator) {
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

        // Inner decorator's catch path returns undefined to signal skip — propagate
        // only when wrapping another decorator. The innermost wrapper sees the user
        // method's real return; an undefined there is the "no payload, just log the
        // event" case (e.g. `appStart() {}`) and must still be emitted.
        if (result === undefined && wrapsAnotherDecorator) {
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
          const effectiveMetadataList =
            process.env.NODE_ENV === 'production'
              ? callContext.metadataList.filter((metadata) => !metadata.devOnly)
              : callContext.metadataList;
          if (this._emitLog && effectiveMetadataList.length > 0) {
            const emitResult = this._emitLog(
              propertyKey,
              result,
              effectiveMetadataList,
            );
            if (
              effectiveMetadataList.some(
                (metadata) =>
                  metadata.type === 'server' && metadata.waitForServer,
              )
            ) {
              return emitResult;
            }
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      } catch (error) {
        cleanupContext();
        if (!(decoratorArgs.devOnly && process.env.NODE_ENV === 'production')) {
          console.error(error);
        }
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

export function LogToLocalDevOnly(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator({
    level: 'info',
    ...decoratorArgs,
    devOnly: true,
    type: 'local',
  });
}

export function LogToServer(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator({ level: 'info', type: 'server', ...decoratorArgs });
}

export function LogToConsole(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator({ level: 'info', type: 'console', ...decoratorArgs });
}

export function LogToConsoleDevOnly(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator({
    level: 'info',
    ...decoratorArgs,
    devOnly: true,
    type: 'console',
  });
}
