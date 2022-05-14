import type {
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
  EVMDecodedItemInternalSwap,
  EVMDecodedTxType,
} from '../vaults/impl/evm/decoder/decoder';

enum TxStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
}

enum EVMTxFromType {
  IN = 'in', // received
  OUT = 'out', // sent
  SELF = 'self', // sent to self
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

type Transfer = {
  blockSignedAt: string;
  txHash: string;
  fromAddress: string;
  fromAddressLabel: string;
  toAddress: string;
  toAddressLabel: string;
  contractDecimals: number;
  contractName: string;
  contractTickerSymbol: string;
  contractAddress: string;
  tokenId: string;
  logoUrl: string;
  /** IN/OUT */
  transferType: string;
  balance: number;
  /** The current balance converted to fiat in quote-currency. */
  balanceQuote: number;
  quoteRate: number;
  /** The delta attached to this transfer. */
  delta: string;
  /** The current delta converted to fiat in quote-currency. */
  deltaQuote: number;
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
  value: string;
  valueQuote: number;
  gasOffered: number;
  gasSpent: number;
  gasPrice: number;
  gasQuote: number;
  gasQuoteRate: number;
  logEvents: Array<LogEvent>;
  transfers: Array<Transfer>;
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
  blockSignedAt: string;
  txHash: string;
  /** Transaction execution result, [true, false] */
  successful: TxStatus;
  fromAddress: string;
  fromAddressLabel: string;
  toAddress: string;
  /** Transaction to address label if exist, such as 'Uniswap Router' */
  toAddressLabel: string;
  /** amount of native currency transfer */
  value: string;
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

  fromType: EVMTxFromType;
  txType: EVMDecodedTxType;

  tokenEvent: Array<Erc20TransferEvent>;
  source: 'local' | 'covalent';
  info:
    | EVMDecodedItemERC20Transfer
    | EVMDecodedItemERC20Approve
    | EVMDecodedItemInternalSwap
    | null;
  rawTx?: string;
};

type Erc20TransferEvent = {
  topics: string[];
  description: string;
  fromAddress: string;
  fromAddressLabel: string;
  toAddress: string;
  toAddressLabel: string;
  tokenAddress: string;
  tokenLogoUrl?: string;
  tokenName?: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenAmount: string;
  tokenId: string;

  fromType: EVMTxFromType;
  txType: EVMDecodedTxType;

  balance: number;
  /** The current balance converted to fiat in quote-currency. */
  balanceQuote: number;
  quoteRate: number;
  /** The delta attached to this transfer. */
  delta: string;
  /** The current delta converted to fiat in quote-currency. */
  deltaQuote: number;
  eventLength: number;
};

type NftDetail = {
  data: {
    updatedAt: string;
    items: Array<NftMetadata>;
    pagination: Pagination;
  };
  error: boolean;
  errorMessage: string;
  errorCode: number;
};

type NftMetadata = {
  contractDecimals: number;
  contractName: string;
  contractTickerSymbol: string;
  contractAddress: string;
  supportsErc: Array<string>;
  logoUrl: string;
  txType: EVMDecodedTxType;
  nftData: Array<NftData>;
};

type NftData = {
  tokenId: string;
  tokenBalance: string;
  tokenUrl: string;
  supportsErc: Array<string>;
  tokenPriceWei: number;
  tokenQuoteRateEth: number;
  originalOwner: string;
  owner: string;
  ownerAddress: string;
  burned: boolean;
  externalData: {
    name: string;
    description: string;
    image: string;
    image256: string;
    image512: string;
    image1024: string;
    animationUrl: string;
    externalUrl: string;
    owner: string;
    attributes: Array<{ traitType: string; value: string }>;
  };
};

export type {
  HistoryDetailList,
  TxDetail,
  Pagination,
  Erc20TransferEvent as TransferEvent,
  LogEvent,
  Transfer,
  Transaction,
  TransactionsRawData,
  NftDetail,
  NftMetadata,
  BlockTransactionWithLogEvents,
};
export { TxStatus, EVMTxFromType };
