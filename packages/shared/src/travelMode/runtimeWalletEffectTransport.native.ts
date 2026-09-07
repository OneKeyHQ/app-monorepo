import { runRuntimeWalletEffect } from './runtimeWalletEffect';

export function createRuntimeWalletEffectTransport<T extends object>(
  transport: T,
): T {
  const wrappedMethods = new Map<
    PropertyKey,
    (...args: unknown[]) => unknown
  >();

  return new Proxy(transport, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      let wrappedMethod = wrappedMethods.get(property);
      if (!wrappedMethod) {
        wrappedMethod = (...args: unknown[]) =>
          runRuntimeWalletEffect(() =>
            Promise.resolve().then(() => Reflect.apply(value, target, args)),
          );
        wrappedMethods.set(property, wrappedMethod);
      }
      return wrappedMethod;
    },
  });
}
