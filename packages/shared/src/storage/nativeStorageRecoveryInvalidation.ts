// Native recovery mutations and mnemonic sessions both run in the bg owner.
const listeners = new Set<() => void>();

export function subscribeNativeStorageRecoveryInvalidation(
  listener: () => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function invalidateNativeStorageRecoverySessions() {
  listeners.forEach((listener) => listener());
}
