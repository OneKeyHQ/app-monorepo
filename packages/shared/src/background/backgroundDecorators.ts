/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-template-expressions */
import {
  throwCrossError,
  warningIfNotRunInBackground,
} from './backgroundUtils';

const INTERNAL_METHOD_PREFIX = 'INTERNAL_';
const PROVIDER_API_METHOD_PREFIX = 'PROVIDER_API_';

// Is a any record, but namely use `PropertyDescriptor['value']`
export type UnknownTarget = Record<string, PropertyDescriptor['value']>;
export type UnknownFunc = (...args: unknown[]) => unknown;

const isFunction = (fn?: any): fn is UnknownFunc =>
  !!fn && {}.toString.call(fn) === '[object Function]';

function backgroundClass() {
  // @ts-ignore
  return function (constructor) {
    if (process.env.NODE_ENV !== 'production') {
      return class extends constructor {
        constructor(...args: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          super(...args);
          warningIfNotRunInBackground({
            name: `[${constructor?.name}] Class`,
            target: this,
          });
        }
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return constructor;
  };
}

function createBackgroundMethodDecorator({ prefix }: { prefix: string }) {
  return function (
    target: UnknownTarget,
    methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    if (typeof descriptor.value !== 'function') {
      throwCrossError(
        '@backgroundMethod() / providerApiMethod only available for method or function.',
        methodName,
      );
    }
    target[`${prefix}${methodName}`] = descriptor.value;
    // return PropertyDescriptor
    // descriptor.value.$isBackgroundMethod = true;
    return descriptor;
  };
}

function backgroundMethod() {
  return createBackgroundMethodDecorator({
    prefix: INTERNAL_METHOD_PREFIX,
  });
}

function providerApiMethod() {
  return createBackgroundMethodDecorator({
    prefix: PROVIDER_API_METHOD_PREFIX,
  });
}

function permissionRequired() {
  return function (
    _: UnknownTarget,
    __: string,
    descriptor: PropertyDescriptor,
  ) {
    const fn = descriptor.value;

    // Checks if "descriptor.value"
    // is a function or not
    if (isFunction(fn)) {
      descriptor.value = function (...args: Array<any>): any {
        // if (this.chainId !== '0x1') {
        //   throw new Error(this.chainId + ' chain not matched');
        // }
        const result = fn.apply(this, args);
        return result;
      };
    }
    return descriptor;
  };
}

function bindThis() {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return function <T extends Function>(
    // eslint-disable-next-line @typescript-eslint/ban-types
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ): TypedPropertyDescriptor<T> | void {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new TypeError(
        `Only methods can be decorated with @bind. <${propertyKey}> is not a method!`,
      );
    }

    // return PropertyDescriptor
    return {
      configurable: true,
      get(this: T): T {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const bound: T = descriptor.value!.bind(this);
        // Credits to https://github.com/andreypopp/autobind-decorator for memoizing the result of bind against a symbol on the instance.
        Object.defineProperty(this, propertyKey, {
          value: bound,
          configurable: true,
          writable: true,
        });
        return bound;
      },
    };
  };
}

export {
  bindThis,
  backgroundClass,
  permissionRequired,
  backgroundMethod,
  providerApiMethod,
  INTERNAL_METHOD_PREFIX,
  PROVIDER_API_METHOD_PREFIX,
};
