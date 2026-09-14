import type { AxiosAdapter } from 'axios';

export function createRuntimeNetworkAdapter(
  adapter: AxiosAdapter,
): AxiosAdapter {
  return adapter;
}
