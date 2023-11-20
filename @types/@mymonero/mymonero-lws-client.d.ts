/* eslint-disable @typescript-eslint/naming-convention */

declare module '@mymonero/mymonero-lws-client' {
  interface MoneroTransaction {
    coinbase: boolean;
    hash: string;
    height: number;
    id: number;
    mempool: boolean;
    mixin: number;
    timestamp: string;
    total_received: string;
    total_sent: string;
    unlock_time: number;
    spent_outputs?: SpentOutout[];
    fee?: string;
  }

  interface SpentOutout {
    amount: string;
    key_image: string;
    mixin: number;
    out_index: number;
    tx_pub_key: string;
    spend_key_images: string[];
    index: number;
  }

  interface MoneroAddressInfo {
    total_received: string;
    total_sent: string;
    locked_funds: string;
    scanned_height: number;
    start_height: number;
    scanned_block_height: number;
    blockchain_height: number;
    transaction_height: number;
    spent_outputs: SpentOutout[];
  }

  interface AmountOut {
    amount: string;
    outputs: SpentOutout[];
  }

  interface Props {
    httpClient?: any;
    url?: string;
    api_key?: string;
    appName?: string;
    appVersion?: string;
  }

  export default class LWSClient {
    constructor(props: Props);

    login: (
      viewKey: string,
      address: string,
      createAccount?: boolean,
    ) => Promise<{ isNewAddress: boolean }>;

    getAddressTxs: (
      viewKey: string,
      address: string,
    ) => Promise<{
      transactions: MoneroTransaction[];
      blockchain_height: number;
    }>;

    getAddressInfo: (
      viewKey: string,
      address: string,
    ) => Promise<MoneroAddressInfo>;

    unspentOutputs: (
      viewKey: string,
      address: string,
    ) => Promise<{
      amount: string;
      outputs: SpentOutout[];
      per_byte_fee: number;
      fee_mask: number;
      fork_version: number;
    }>;

    randomOutputs: (
      numberOfOutputs: number,
    ) => Promise<{ amount_outs: AmountOut[] }>;
  }

  export { MoneroAddressInfo, MoneroTransaction, SpentOutout };
}
