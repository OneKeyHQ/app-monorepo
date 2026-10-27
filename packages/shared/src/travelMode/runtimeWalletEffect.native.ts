import { travelModeManager } from '.';

export function runRuntimeWalletEffect<T>(
  operation: () => Promise<T>,
  options?: { allowInTravelMode?: boolean },
): Promise<T> {
  return travelModeManager
    .getRuntimeEnvironmentSync()
    .walletEffects.runOrReject(operation, options);
}
