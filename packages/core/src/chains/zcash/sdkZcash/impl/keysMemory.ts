import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// The keys module is synchronous and single-threaded. Upstream crypto code
// can leave copies in inactive stack frames even after owned inputs are cleared.
export function wrapKeysModuleWithStackCleanup<T extends object>(
  module: T,
  instance: { memory: WebAssembly.Memory },
): T {
  const lowExport =
    '__stack_low' in instance ? instance.__stack_low : undefined;
  const highExport =
    '__stack_high' in instance ? instance.__stack_high : undefined;
  if (
    !(lowExport instanceof WebAssembly.Global) ||
    !(highExport instanceof WebAssembly.Global)
  ) {
    throw new OneKeyLocalError(
      'zcash: keys WASM stack bounds are missing; rebuild the keys package',
    );
  }
  const low: unknown = lowExport.value;
  const high: unknown = highExport.value;
  if (
    typeof low !== 'number' ||
    typeof high !== 'number' ||
    !Number.isSafeInteger(low) ||
    !Number.isSafeInteger(high) ||
    low < 0 ||
    high <= low ||
    high > instance.memory.buffer.byteLength
  ) {
    throw new OneKeyLocalError('zcash: keys WASM stack bounds are invalid');
  }

  let depth = 0;
  const entries: [string, unknown][] = Object.entries(module);
  return Object.fromEntries(
    entries.map(([name, value]) => {
      // Initialization is the only async export; it does not execute keys code.
      if (
        name === 'default' ||
        name === 'initSync' ||
        typeof value !== 'function'
      ) {
        return [name, value];
      }
      return [
        name,
        (...args: unknown[]): unknown => {
          depth += 1;
          try {
            return Reflect.apply(value, undefined, args);
          } finally {
            depth -= 1;
            // A WASM import (e.g. a random source) can reenter another exported
            // function. Never wipe while an outer Rust stack frame is still live.
            if (depth === 0) {
              // Recreate the view: a call may have grown and replaced the buffer.
              new Uint8Array(instance.memory.buffer).fill(0, low, high);
            }
          }
        },
      ];
    }),
  ) as T;
}
