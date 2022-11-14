import type { Transaction, TransactionMetadata } from 'xrpl';

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

interface ResponseOnlyTxInfo {
  date?: number;
  hash?: string;
  ledger_index?: number;
}

export interface IXrpTransaction {
  meta: string | TransactionMetadata;
  tx?: Transaction & ResponseOnlyTxInfo;
}
