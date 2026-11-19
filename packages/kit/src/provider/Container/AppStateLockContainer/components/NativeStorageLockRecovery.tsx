// Native storage has an independent background owner only on mobile.
export function useNativeStorageLockError(): string | undefined {
  return undefined;
}

export function NativeStorageLockError(_props: { message?: string }) {
  return null;
}

export function NativeStorageLockToast(_props: { message?: string }) {
  return null;
}
