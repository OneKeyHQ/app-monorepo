import Axios from 'axios';

import { OneKeyError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { AxiosInstance } from 'axios';

interface ICosmosBlockHeader {
  version: any;
  chain_id: string;
  height: string;
  time: Date;
  last_block_id: any;
  last_commit_hash: string;
  data_hash: string;
  consensus_hash: string;
  app_hash: string;
  last_results_hash: string;
  evidence_hash: string;
  proposer_address: string;
}

interface ICosmosBroadcastTxResponse {
  height: string;
  txhash: string;
  codespace: string;
  code: number;
  data: string;
  raw_log: string;
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: {
    type_url: string;
    value: string;
  };
  timestamp: string;
}

export class ClientCosmos {
  public readonly axios: AxiosInstance;

  constructor({ url }: { url: string }) {
    this.axios = Axios.create({
      baseURL: url,
      timeout: timerUtils.getTimeDurationMs({ seconds: 30 }),
    });
  }

  public async fetchBlockHeaderV1beta1(): Promise<ICosmosBlockHeader> {
    const response = await this.axios.get<{
      block: { header: ICosmosBlockHeader };
      // eslint-disable-next-line spellcheck/spell-checker
    }>(`/cosmos/base/tendermint/v1beta1/blocks/latest`);
    return response.data.block.header;
  }

  async broadcastTransaction({
    rawTx,
  }: {
    rawTx: string;
  }): Promise<string | null> {
    const data = {
      mode: 'BROADCAST_MODE_SYNC',
      tx_bytes: rawTx,
    };
    const resp = await this.axios.post<{
      tx_response: ICosmosBroadcastTxResponse;
    }>('/cosmos/tx/v1beta1/txs', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const rawLog = resp.data.tx_response.raw_log;
    const { code } = resp.data.tx_response;

    if (code != null && code !== 0) {
      throw new OneKeyError(rawLog);
    }

    return resp.data.tx_response?.txhash ?? null;
  }
}
