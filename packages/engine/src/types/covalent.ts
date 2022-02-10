import { HasName } from './base';

type HistoryDetilList = {
  data: Transactions;
  error: boolean;
  errorMessage: string;
  errorCode: number;
};

type TxDetail = {
  data: { updatedAt: string; items: Transactions[]; pagination: Pagination };
  error: boolean;
  errorMessage: string;
  errorCode: number;
};

type HistoryQuery = {
  chainId: string;
  address: string;
  pageNumber: number;
  pageSize: number;
  quoteCurrency?: string;
  format?: string;
  blockSignedAtAsc?: boolean;
  noLogs?: boolean;
};

type TxQuery = {
  chainId: string;
  txHash: string;
  quoteCurrency?: string;
  format?: string;
  noLogs?: boolean;
};

type Pagination = HasName & {
  hasMore: boolean;
  pageNumber: number;
  pageSize: number;
  totalCount: number;
};

type Transactions = HasName & {
  address: string;
  updatedAt: string;
  nextUpdateAt: string;
  quoteCurrency: string;
  chainId: number;
  paging: Pagination;
  items: Array<BlockTransactionWithLogEvents>;
};

type BlockTransactionWithLogEvents = HasName & {
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
  gasPrice: number;
  gasQuote: number;
  gasQuoteRate: number;
  logEvents: Array<LogEvent>;
};

type LogEvent = HasName & {
  blockSignedAt: string;
  blockHeight: number;
  txHash: string;
  txOffset: number;
  logOffset: number;
  rawLogTopics: string[];
  senderContractDecimals: number;
  senderName: string;
  senderContractTickerSymbol: string;
  senderAddress: string;
  senderAddressLabel: string;
  senderLogoURI: string;
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

export type {
  HistoryQuery,
  TxQuery,
  HistoryDetilList,
  TxDetail,
  Pagination,
  Transactions,
  BlockTransactionWithLogEvents,
  LogEvent,
};
