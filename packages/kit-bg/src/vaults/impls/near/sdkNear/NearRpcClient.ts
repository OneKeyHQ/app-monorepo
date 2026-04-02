import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

export class NearRpcClient {
  readonly rpc: JsonRPCRequest;

  constructor({ url }: { url: string }) {
    this.rpc = new JsonRPCRequest(`${url}/json_rpc`);
  }

  async getBestBlock(): Promise<{ blockNumber: number; blockHash: string }> {
    const resp = await this.rpc.call<{
      sync_info: { latest_block_height: string; latest_block_hash: string };
    }>('status', []);
    return {
      blockNumber: Number(resp.sync_info.latest_block_height),
      blockHash: resp.sync_info.latest_block_hash,
    };
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    const tx = await this.rpc.call<{ transaction: { hash: string } }>(
      'broadcast_tx_commit',
      [rawTx],
    );
    return tx.transaction.hash;
  }
}
