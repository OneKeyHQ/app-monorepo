import { CanceledError } from 'axios';

import type { AxiosAdapter } from 'axios';

export async function canDispatchGuardedWalletRequests() {
  const { isGuardedWalletRequestTransportAvailable } =
    await import('../request/guardedWalletRequest');
  return isGuardedWalletRequestTransportAvailable();
}

export function createRuntimeNetworkAdapter(
  adapter: AxiosAdapter,
  allowsGuardedWalletRequests = false,
): AxiosAdapter {
  return (config) => {
    if (!config.$oneKeyGuardedWalletRequest) return adapter(config);
    if (!allowsGuardedWalletRequests)
      return Promise.reject(new CanceledError());
    return import('../request/guardedWalletRequest').then(
      ({ dispatchGuardedWalletRequest }) =>
        dispatchGuardedWalletRequest(config),
    );
  };
}
