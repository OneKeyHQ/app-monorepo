// @ts-nocheck
/* eslint-disable  */

const INTERNAL_METHOD_PREFIX = 'internal_';

// TODO rename to backgroundMethod()
function internalMethod() {
  return function (
    target: any,
    name: any,
    descriptor: {
      value: any;
    },
  ) {
    target[`${INTERNAL_METHOD_PREFIX}${name}`] = descriptor.value;
    console.log('======= internalMethod', this, target);
    return descriptor;
  };
}

function permissionRequired() {
  return function (
    target: any,
    name: any,
    descriptor: {
      value: any;
    },
  ) {
    const fn = descriptor.value as any;

    // Checks if "descriptor.value"
    // is a function or not
    if (typeof fn === 'function') {
      descriptor.value = function (...args) {
        console.log(`parameters: ${args}`);

        // if (this.walletApi.chainId !== '0x1') {
        //   throw new Error(this.chainId + ' chain not matched');
        // }

        const result: any = fn.apply(this, args);

        console.log(`addition: ${result}`);

        return result;
      };
    }
    return descriptor;
  };
}

export { permissionRequired, internalMethod, INTERNAL_METHOD_PREFIX };
