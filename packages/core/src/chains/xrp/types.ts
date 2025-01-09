export interface IEncodedTxXrp {
  TransactionType: 'Payment';
  Account: string;
  Fee?: string;
  Amount: string;
  Destination: string;
  DestinationTag?: number;
  Flags?: number;
  Sequence?: number;
  LastLedgerSequence?: number;
}

export type IDecodedTxExtraXrp = {
  destinationTag?: number;
  lastLedgerSequence?: number;
  ledgerIndex?: number;
};
