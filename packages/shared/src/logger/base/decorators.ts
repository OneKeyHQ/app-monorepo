import { Metadata, NO_LOG_OUTPUT } from '../types';

import type { IMethodDecoratorMetadata } from '../types';

function createDecorator(decoratorArgs: IMethodDecoratorMetadata) {
  return function logMethod(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (...args: any[]) => any;
    if (typeof originalMethod !== 'function') {
      throw new Error('This decorator is only for methods');
    }
    descriptor.value = function (...args: any[]) {
      let result = originalMethod.apply(this, args);

      if (!Array.isArray(result)) {
        result = [result];
      }

      if (Array.isArray(result)) {
        result = result.filter((item) => item !== NO_LOG_OUTPUT);
        if ((result as any[])?.length === 0) {
          return null;
        }
      }
      const metadata = (result as Metadata[])[0];
      if (metadata && metadata instanceof Metadata) {
        const newDecoratorArgs: IMethodDecoratorMetadata[] = [];
        if (Array.isArray(metadata.metadata)) {
          newDecoratorArgs.push(...metadata.metadata);
        } else {
          newDecoratorArgs.push(metadata.metadata);
        }
        if (newDecoratorArgs.length > 0) {
          newDecoratorArgs.push(decoratorArgs);
          return new Metadata(metadata.args, newDecoratorArgs);
        }
      }
      return new Metadata(result, decoratorArgs);
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
