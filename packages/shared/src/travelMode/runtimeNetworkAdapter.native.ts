import { isTravelModeNetworkRequestAllowed } from './runtimeNetworkAllowlist';
import { runRuntimeWalletEffect } from './runtimeWalletEffect';

import type { AxiosAdapter } from 'axios';

export function createRuntimeNetworkAdapter(
  adapter: AxiosAdapter,
): AxiosAdapter {
  return (config) => {
    const operation = () => Promise.resolve().then(() => adapter(config));
    const allowInTravelMode = isTravelModeNetworkRequestAllowed(config);
    return runRuntimeWalletEffect(
      operation,
      allowInTravelMode ? { allowInTravelMode: true } : undefined,
    );
  };
}
