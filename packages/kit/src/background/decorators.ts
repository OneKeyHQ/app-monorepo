const INTERNAL_METHOD_PREFIX = 'internal_';

// Is a any record, but namely use `PropertyDescriptor['value']`
export type UnknownTarget = Record<string, PropertyDescriptor['value']>;
export type UnknownFunc = (...args: unknown[]) => unknown;

const isFunction = (fn?: any): fn is UnknownFunc =>
  !!fn && {}.toString.call(fn) === '[object Function]';

function backgroundMethod() {
  return function (
    target: UnknownTarget,
    methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    target[`${INTERNAL_METHOD_PREFIX}${methodName}`] = descriptor.value;
    return descriptor;
  };
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
        console.log(`parameters: (${args.toString()})`);

        // if (this.walletApi.chainId !== '0x1') {
        //   throw new Error(this.chainId + ' chain not matched');
        // }

        const result = fn.apply(this, args);

        console.log('addition:', result);

        return result;
      };
    }
    return descriptor;
  };
}

export { permissionRequired, backgroundMethod, INTERNAL_METHOD_PREFIX };
