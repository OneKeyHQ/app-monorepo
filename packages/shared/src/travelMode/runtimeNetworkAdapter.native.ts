import { runRuntimeWalletEffect } from './runtimeWalletEffect';

import type { AxiosAdapter } from 'axios';

export function createRuntimeNetworkAdapter(
  adapter: AxiosAdapter,
): AxiosAdapter {
  return (config) => runRuntimeWalletEffect(() => adapter(config));
}
