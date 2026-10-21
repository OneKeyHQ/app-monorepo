import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IStarknetTransport } from './types';

/**
 * Proxies Starknet JSON-RPC through OneKey's servers, the same route Stellar
 * uses. Not reachable yet: the backend has no Starknet proxy, so
 * STARKNET_BACKEND_PROXY_ENABLED is false and this class is the target state
 * rather than the current one.
 *
 * isJsonRpc is set, unlike Stellar's transport, because Starknet control flow
 * reads RPC error codes: an undeployed account is nothing but error 20 from
 * starknet_getClassHashAt. Without it sendProxyRequest collapses the error into
 * a message string and deploy detection would throw instead of returning false.
 * Confirm the backend returns raw JSON-RPC envelopes on this route before
 * flipping the flag.
 */
export class OneKeyTransport implements IStarknetTransport {
  /** empty: requests go through the backend, not to a url this app knows */
  readonly rpcUrl = '';

  private readonly backgroundApi: IBackgroundApi;

  private readonly networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: IBackgroundApi;
    networkId: string;
  }) {
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;
  }

  async request<T>(method: string, params: unknown[]): Promise<T> {
    const res: T[] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<T>({
        networkId: this.networkId,
        isJsonRpc: true,
        body: [
          {
            route: 'rpc',
            params: {
              method,
              params,
            },
          },
        ],
      });

    const response = res?.[0];
    if (response === undefined) {
      throw new OneKeyLocalError('No response received from Starknet proxy');
    }
    return response;
  }
}
