export interface IEncodedTxXrp {
  TransactionType: 'Payment';
  Account: string;
  Fee?: string;
  Amount: string;
  Destination: string;
  DestinationTag?: number;
}
