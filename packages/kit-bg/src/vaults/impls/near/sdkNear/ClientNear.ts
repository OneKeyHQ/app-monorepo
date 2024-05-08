/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import { baseDecode } from '../utils';

import type { INearAccessKey } from '../types';

function parseJsonFromRawResponse(response: Uint8Array): any {
  return JSON.parse(Buffer.from(response).toString());
}

function bytesJsonStringify(input: any): Buffer {
  return Buffer.from(JSON.stringify(input));
}

class ClientNear {
  private backgroundApi: IBackgroundApi;

  private networkId: string;

  private defaultFinality: 'optimistic' | 'final';

  constructor({
    backgroundApi,
    networkId,
    defaultFinality = 'optimistic',
  }: {
    backgroundApi: any;
    networkId: string;
    defaultFinality?: 'optimistic' | 'final';
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
    this.defaultFinality = defaultFinality;
  }

  async getAccessKeys(address: string): Promise<INearAccessKey[]> {
    const [info] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        keys: any[];
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'query',
              params: {
                request_type: 'view_access_key_list',
                account_id: address,
                finality: this.defaultFinality,
              },
            },
          },
        ],
      });

    return info.keys.map((key: any) => {
      const { permission } = key.access_key;
      const isFullAccessKey = permission === 'FullAccess';

      return {
        type: isFullAccessKey ? 'FullAccess' : 'FunctionCall',
        pubkey: key.public_key,
        pubkeyHex: baseDecode(key.public_key.split(':')[1] || '').toString(
          'hex',
        ),
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        nonce: key.access_key.nonce + 1,
        functionCall: !isFullAccessKey
          ? {
              allowance: permission.FunctionCall.allowance,
              receiverId: permission.FunctionCall.receiver_id,
              methodNames: permission.FunctionCall.method_names,
            }
          : undefined,
      };
    });
  }

  async getBestBlock(): Promise<{ blockNumber: number; blockHash: string }> {
    const [resp] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        sync_info: {
          latest_block_height: string;
          latest_block_hash: string;
        };
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'status',
              params: [],
            },
          },
        ],
      });
    return {
      blockNumber: Number(resp.sync_info.latest_block_height),
      blockHash: resp.sync_info.latest_block_hash,
    };
  }

  async callContract(
    contract: string,
    methodName: string,
    args: any = {},
    { parse = parseJsonFromRawResponse, stringify = bytesJsonStringify } = {},
  ): Promise<any> {
    const serializedArgs = stringify(args).toString('base64');
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        result: any[];
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'query',
              params: {
                request_type: 'call_function',
                finality: this.defaultFinality,
                method_name: methodName,
                account_id: contract,
                args_base64: serializedArgs,
              },
            },
          },
        ],
      });

    return (
      result.result &&
      result.result.length > 0 &&
      parse(Buffer.from(result.result))
    );
  }
}

export default ClientNear;
