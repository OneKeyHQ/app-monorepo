import { isPromiseObject } from '../utils/promiseUtils';

import { Metadata } from './types';

import type { IMethodDecoratorMetadata } from './types';

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
    descriptor.value = async function (...args: any[]) {
      let result = originalMethod.apply(this, args);
      if (isPromiseObject(result)) {
        result = await result;
      }
      if (!Array.isArray(result)) {
        result = [result];
      }
      return new Metadata(result, decoratorArgs);
    };
    return descriptor;
  };
}

export function LogToLocal(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator(decoratorArgs ?? { level: 'info', type: 'local' });
}

export function LogToServer(decoratorArgs?: IMethodDecoratorMetadata) {
  return createDecorator(decoratorArgs ?? { level: 'info', type: 'server' });
}
