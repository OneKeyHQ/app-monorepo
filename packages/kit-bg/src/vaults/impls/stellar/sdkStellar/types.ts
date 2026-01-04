export type ISimulateTransactionResponse = {
  latestLedger: number;
  minResourceFee?: string;
  results?: Array<{
    xdr: string;
    auth: string[];
  }>;
  transactionData?: string;
  events?: string[];
  restorePreamble?: {
    minResourceFee: string;
    transactionData: string;
  };
  stateChanges?: Array<{
    type: 'created' | 'updated' | 'deleted';
    key: string;
    before: string | null;
    after: string | null;
  }>;
  error?: string;
};
