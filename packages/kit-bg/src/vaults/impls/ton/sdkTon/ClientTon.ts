import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

export class ClientTon {
  readonly rpc: JsonRPCRequest;

  constructor({ url }: { url: string }) {
    this.rpc = new JsonRPCRequest(`${url}`);
  }

  async getMasterChainInfo(): Promise<{ blockHeight: number }> {
    const masterChainResponse = await this.rpc.call<{
      last: {
        seqno: number;
      };
    }>('getMasterchainInfo', []);
    const sequenceNumber = masterChainResponse.last?.seqno;
    if (typeof sequenceNumber !== 'number') {
      throw new OneKeyError('Invalid masterchain response');
    }
    return {
      blockHeight: sequenceNumber,
    };
  }

  async sendBocReturnHash({ boc }: { boc: string }): Promise<string> {
    const result = await this.rpc.call<{ hash: string }>('sendBocReturnHash', {
      boc,
    });

    const { hash } = result ?? {};
    if (!hash) {
      throw new OneKeyError('Invalid hash');
    }
    const txId = this.convertHashToTxId(hash);
    return txId;
  }

  private convertHashToTxId(str: string) {
    const raw = Buffer.from(str, 'base64').toString('binary');
    let result = '';

    for (let i = 0; i < raw.length; i += 1) {
      const hex = raw.charCodeAt(i).toString(16);
      result += hex.length === 2 ? hex : `0${hex}`;
    }

    return result;
  }
}
