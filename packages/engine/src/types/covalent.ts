enum TransactionType {
  Transfer = 'Transfer',
  Receive = 'Receive',
  ContractExecution = 'ContractExecution',
}

type HistoryDetailList = {
  data: TransactionsRawData;
  error: boolean;
  errorMessage: string | null;
  errorCode: number | null;
};

type Pagination = {
  hasMore: boolean;
  pageNumber: number;
  pageSize: number;
  totalCount: number;
};

type TxDetail = {
  data: {
    updatedAt: string;
    items: Array<BlockTransactionWithLogEvents>;
    pagination: Pagination;
  };
  error: boolean;
  errorMessage: string;
  errorCode: number;
};

type TransactionsRawData = {
  address: string;
  updatedAt: string;
  nextUpdateAt: string;
  quoteCurrency: string;
  chainId: number;
  pagination: Pagination;
  items: Array<BlockTransactionWithLogEvents>;
  txList: Array<Transaction> | null;
};

type BlockTransactionWithLogEvents = {
  blockSignedAt: string;
  blockHeight: number;
  txHash: string;
  txOffset: number;
  successful: boolean;
  fromAddress: string;
  toAddress: string;
  toAddressLabel: string;
  value: number;
  valueQuote: number;
  gasOffered: number;
  gasSpent: number;
  gasPrice: number;
  gasQuote: number;
  gasQuoteRate: number;
  logEvents: Array<LogEvent>;
};

type LogEvent = {
  blockSignedAt: string;
  blockHeight: number;
  txOffset: number;
  txHash: string;
  logOffset: number;
  rawLogTopics: string[];
  senderContractDecimals: number;
  senderName: string;
  senderContractTickerSymbol: string;
  senderAddress: string;
  senderAddressLabel: string;
  senderLogoUrl: string;
  rawLogData: string;
  decoded: {
    name: string;
    signature: string;
    params: {
      name: string;
      type: string;
      indexed: boolean;
      decoded: boolean;
      value: string;
    }[];
  };
};

type Transaction = {
  blockHeight: number;
  txHash: string;
  /** Transaction execution result, [true, false] */
  successful: boolean;
  fromAddress: string;
  toAddress: string;
  /** Transaction to address label if exist, such as 'Uniswap Router' */
  toAddressLabel: string;
  /** amount of native currency transfer */
  value: number;
  /** amount of native currency transfer with USD value */
  valueQuote: number;
  /** gas total limit by the transaction */
  gasOffered: number;
  /** gas total used by the transaction */
  gasSpent: number;
  /** gas price offered by the transaction */
  gasPrice: number;
  /** gas cost in USD */
  gasQuote: number;
  /** gas cost in USD / native currency exchange rate at that tx confirm time */
  gasQuoteRate: number;
  /**  Transaction type, enum [ Transfer, Receive, ContractExecution] */
  type: TransactionType;
  TokenEvent: Array<DecodedEvent> | null;
};

type DecodedEvent = {
  topics: string[];
  description: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  tokenLogoUrl: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenAmount: string;
};

export type {
  HistoryDetailList,
  TxDetail,
  Pagination,
  DecodedEvent,
  LogEvent,
  Transaction,
  TransactionsRawData,
  BlockTransactionWithLogEvents,
};
export { TransactionType };
