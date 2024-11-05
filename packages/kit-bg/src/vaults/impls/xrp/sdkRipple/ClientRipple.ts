import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

export class ClientRipple {
  readonly rpc: JsonRPCRequest;

  constructor({ url }: { url: string }) {
    this.rpc = new JsonRPCRequest(`${url}`);
  }

  async getBlockHeight(): Promise<{ blockHeight: number }> {
    const resp = await this.rpc.call<{
      ledger_current_index: number;
      status: string;
    }>('ledger_current', []);
    return {
      blockHeight: resp.ledger_current_index,
    };
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    const result = await this.rpc.call<{
      tx_json: {
        hash: string;
      };
    }>('submit', [{ tx_blob: rawTx }]);
    return result.tx_json.hash;
  }
}
