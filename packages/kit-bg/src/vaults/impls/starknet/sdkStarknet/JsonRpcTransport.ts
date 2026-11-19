import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import type { IStarknetTransport } from './types';

/**
 * Direct JSON-RPC 2.0 transport for a user-configured custom RPC only.
 *
 * The url is used exactly as configured: providers disagree about spec paths
 * (`/rpc/v0_9` is required by some and a 404 on others), so appending one to a
 * user-pasted url breaks more endpoints than it fixes.
 */
export class JsonRpcTransport implements IStarknetTransport {
  readonly rpcUrl: string;

  private readonly client: JsonRPCRequest;

  constructor({ rpcUrl }: { rpcUrl: string; networkId: string }) {
    this.rpcUrl = rpcUrl;
    this.client = new JsonRPCRequest(rpcUrl);
  }

  async request<T>(method: string, params: unknown[]): Promise<T> {
    return this.client.call<T>(method, params);
  }
}
