export function runRuntimeWalletEffect<T>(
  operation: () => Promise<T>,
): Promise<T> {
  return operation();
}
