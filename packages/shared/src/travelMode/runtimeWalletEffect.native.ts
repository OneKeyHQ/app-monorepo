import { travelModeManager } from '.';

export function runRuntimeWalletEffect<T>(
  operation: () => Promise<T>,
): Promise<T> {
  return travelModeManager
    .getRuntimeEnvironmentSync()
    .walletEffects.runOrReject(operation);
}
