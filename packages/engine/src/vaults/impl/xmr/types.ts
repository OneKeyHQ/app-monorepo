export interface IMoneroAddressInfo {
  total_received: string;
  total_sent: string;
  locked_funds: string;
  scanned_height: number;
  start_height: number;
  scanned_block_height: number;
  blockchain_height: number;
  transaction_height: number;
  spent_outputs: any[];
}

export interface IOnChainHistoryTx {}

export interface MoneroKeys {
  publicViewKey: string;
  publicSpendKey: string;
  privateViewKey: string;
  privateSpendKey: string;
}
