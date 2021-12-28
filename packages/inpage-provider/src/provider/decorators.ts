/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/restrict-template-expressions */

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
    const fn = descriptor.value;

    // Checks if "descriptor.value"
    // is a function or not
    if (typeof fn === 'function') {
      descriptor.value = function (...args: Array<any>): any {
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
