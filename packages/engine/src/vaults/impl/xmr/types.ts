export interface MoneroAddressInfo {
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
