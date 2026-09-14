export function runRuntimeWalletEffect<T>(
  operation: () => Promise<T>,
  _options?: { allowInTravelMode?: boolean },
): Promise<T> {
  return operation();
}
