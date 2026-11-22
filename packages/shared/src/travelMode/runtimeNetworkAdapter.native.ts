import { CanceledError } from 'axios';

import { isTravelModeNetworkRequestAllowed } from './runtimeNetworkAllowlist';
import { runRuntimeWalletEffect } from './runtimeWalletEffect';

import type { AxiosAdapter } from 'axios';

export function canDispatchGuardedWalletRequests() {
  return Promise.resolve(false);
}

export function createRuntimeNetworkAdapter(
  adapter: AxiosAdapter,
): AxiosAdapter {
  return (config) => {
    if (config.$oneKeyGuardedWalletRequest)
      return Promise.reject(new CanceledError());
    const operation = () => Promise.resolve().then(() => adapter(config));
    const allowInTravelMode = isTravelModeNetworkRequestAllowed(config);
    return runRuntimeWalletEffect(
      operation,
      allowInTravelMode ? { allowInTravelMode: true } : undefined,
    );
  };
}
