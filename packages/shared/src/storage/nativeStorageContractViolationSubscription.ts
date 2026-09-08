/**
 * Non-native stub for the native storage contract-violation subscription.
 *
 * Contract violations are only produced by the native AsyncStorage guard, so
 * web, desktop and extension builds resolve this no-op stub. This keeps the
 * violation module (and its runtime portion of nativeStorageTypes) out of
 * non-native startup graphs.
 */
import type { INativeStorageContractViolation } from './nativeStorageTypes';

export function subscribeNativeStorageContractViolations(
  _listener: (violation: INativeStorageContractViolation) => void,
): () => void {
  return () => {};
}
