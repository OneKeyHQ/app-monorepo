import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import type { SendConfirmPayloadBase } from '../Send/types';

export enum SwapRoutes {
  Swap = 'Swap',
  Input = 'Input',
  Output = 'Output',
  OutputCrosschain = 'OutputCrosschain',
  Settings = 'Settings',
  CustomToken = 'CustomToken',
  Transaction = 'Transaction',
  Webview = 'Webview',
  Share = 'Share',
  SwftcHelp = 'SwftcHelp',
  PickRecipient = 'PickRecipient',
  PickAccount = 'PickAccount',
  SelectSendingAccount = 'SelectSendingAccount',
  SelectRecipient = 'SelectRecipient',
  EnterAddress = 'EnterAddress',
  Welcome = 'Welcome',
  SelectRoutes = 'SelectRoutes',
  Slippage = 'Slippage',
  SlippageCheck = 'SlippageCheck',
  LimitOrderInput = 'LimitOrderInput',
  LimitOrderOutput = 'LimitOrderOutput',
  LimitOrderDetails = 'LimitOrderDetails',
  TransactionSubmitted = 'TransactionSubmitted',
  HardwareContinue = 'HardwareContinue',
  ChainSelector = 'ChainSelector',
}

export type SwapRoutesParams = {
  [SwapRoutes.Swap]: undefined;
  [SwapRoutes.Input]: undefined;
  [SwapRoutes.Output]: undefined;
  [SwapRoutes.OutputCrosschain]: undefined;
  [SwapRoutes.LimitOrderInput]: undefined;
  [SwapRoutes.LimitOrderOutput]: undefined;
  [SwapRoutes.Settings]: undefined;
  [SwapRoutes.Webview]: { url: string };
  [SwapRoutes.SwftcHelp]: { orderid: string };
  [SwapRoutes.PickAccount]:
    | {
        networkId?: string;
        onSelected?: (acc: Account) => void;
      }
    | undefined;
  [SwapRoutes.SelectSendingAccount]:
    | {
        accountId?: string;
        networkId?: string;
        onSelected?: (acc: Account) => void;
      }
    | undefined;
  [SwapRoutes.PickRecipient]:
    | {
        networkId?: string;
        onSelected?: (data: {
          address: string;
          name?: string;
          accountId?: string;
        }) => void;
      }
    | undefined;
  [SwapRoutes.SelectRecipient]:
    | {
        networkId?: string;
        onSelected?: (data: {
          address: string;
          name?: string;
          accountId?: string;
        }) => void;
      }
    | undefined;
  [SwapRoutes.EnterAddress]:
    | {
        networkId?: string;
        contactExcludeWalletAccount?: boolean;
        onSelected?: (data: { address: string; name?: string }) => void;
      }
    | undefined;
  [SwapRoutes.CustomToken]: { address?: string } | undefined;
  [SwapRoutes.Transaction]: {
    txid: string;
    goBack?: () => void;
  };
  [SwapRoutes.Share]: {
    txid: string;
  };
  [SwapRoutes.Welcome]: undefined;
  [SwapRoutes.SelectRoutes]: undefined;
  [SwapRoutes.Slippage]: undefined;
  [SwapRoutes.SlippageCheck]: ISlippageSetting;
  [SwapRoutes.LimitOrderDetails]: { orderHash: string };
  [SwapRoutes.TransactionSubmitted]: { orderHash: string };
  [SwapRoutes.HardwareContinue]: undefined;
  [SwapRoutes.ChainSelector]: {
    networkIds?: string[];
    onSelect?: (networkId: string) => void;
  };
};

export enum SwapError {
  QuoteFailed = 'QuoteFailed',
  InsufficientBalance = 'InsufficientBalance',
  NotSupport = 'NotSupport',
  DepositMax = 'DepositMax',
  DepositMin = 'DepositMin',
}

export enum QuoterType {
  swftc = 'swftc',
  socket = 'socket',
  mdex = 'mdex',
  zeroX = '0x',
  jupiter = 'jupiter',
  onekey = 'onekey',
  deezy = 'Deezy',
  thorswap = 'Thorswap',
  thorswapStream = 'ThorswapStream',
}

export type FieldType = 'INPUT' | 'OUTPUT';

export type Recipient = {
  address?: string;
  name?: string;
  accountId?: string;
  networkId?: string;
  networkImpl?: string;
};

export type TransactionData = IEncodedTx;

export type FetchQuoteParams = {
  networkOut: Network;
  networkIn: Network;
  tokenOut: Token;
  tokenIn: Token;
  slippagePercentage: string;
  typedValue: string;
  independentField: FieldType;
  activeAccount: Account;
  receivingAddress?: string;
  onChainSatsPerVbyte?: string;
};

export type QuoteLimited = {
  max?: string;
  min?: string;
};

export type FetchQuoteResponse = {
  data?: QuoteData;
  limited?: QuoteLimited;
};

export type Provider = {
  name: string;
  logoUrl?: string;
};

export type ProtocolFees = {
  amount: string;
  asset: {
    symbol: string;
    decimals: number;
    name: string;
    address: string;
    chainId: number;
  };
};

export type QuoteData = {
  type: QuoterType;
  instantRate: string;
  sellAmount: string;
  sellTokenAddress: string;
  buyAmount: string;
  buyTokenAddress: string;
  wrapperTxInfo?: WrapperTransactionInfo;
  allowanceTarget?: string;
  providers?: Provider[];
  arrivalTime?: number;
  txData?: TransactionData;
  additionalParams?: BuildTransactionAdditionalParameters;
  needApproved?: boolean;
  percentageFee?: string;
  estimatedBuyAmount?: string;
  quoterlogo?: string;
  minAmountOut?: string;
  protocolFees?: ProtocolFees;
  estimatedPriceImpact?: string;
  onChainSatsPerVbyte?: string;
  notImpactBySlippage?: boolean;
};

type WrapperTransactionType = 'Withdraw' | 'Deposite';

export type WrapperTransactionInfo = {
  isWrapperTransaction: boolean;
  type: WrapperTransactionType;
  encodedTx: IEncodedTx;
};

export type SwapRecord = {
  txid: string;
  from: {
    tokenName: string;
    tokenAddress: string;
    networkName: string;
    networkId: string;
    amount: string;
  };
  to: {
    tokenName: string;
    tokenAddress: string;
    networkName: string;
    networkId: string;
    amount: string;
  };
  params: BuildTransactionParams;
  response: BuildTransactionResponse;
};

export interface BuildTransactionAdditionalParameters {
  socketUsedBridgeNames?: string[];
}

export interface TransactionAttachment {
  swftcOrderId?: string;
  swftcPlatformAddr?: string;
  swftcDepositCoinAmt?: string;
  swftcDepositCoinCode?: string;
  swftcReceiveCoinAmt?: string;
  swftcReceiveCoinCode?: string;
  socketUsedBridgeNames?: string[];

  thorswapQuoteId?: string;
}

export interface ThorswapOrderReceipt {
  quoteId: string;
}

export type BuildTransactionParams = FetchQuoteParams & {
  sellAmount: string;
  buyAmount: string;
  disableValidate?: boolean;
  txData?: TransactionData;
  additionalParams?: BuildTransactionAdditionalParameters;
};

type BuildTransactionError = {
  code?: string;
  msg?: string;
};

export type BuildTransactionResponse = {
  data?: TransactionData;
  attachment?: TransactionAttachment;
  error?: BuildTransactionError;
  result?: {
    quoter: string;
    instantRate: string;
    sellAmount: string;
    sellTokenAddress: string;
    buyAmount: string;
    buyTokenAddress: string;
    allowanceTarget?: string;
    sources?: {
      name: string;
      logoUrl?: string;
    }[];
  };
  requestId?: string;
};

export type SwapQuoteTx = SendConfirmPayloadBase &
  QuoteData &
  TransactionData & { to: string; value: string };

export interface TransactionLog {
  address: string;
  blockHash: string;
  blockNumber: string;
  topics: string[];
  data: string;
}

export interface SerializableTransactionReceipt {
  to: string;
  from: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  contractAddress: string;
  transactionIndex: number;
  blockHash: string;
  transactionHash: string;
  blockNumber: number;
  status?: string;
  logs?: TransactionLog[];
}

export type SOLSerializableTransactionReceiptTokenBalancesItem = {
  mint: string;
  owner: string;
  uiTokenAmount: {
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: 'string';
  };
};

export interface SOLSerializableTransactionReceipt {
  meta: {
    preBalances: number[];
    postBalances: number[];
    postTokenBalances: SOLSerializableTransactionReceiptTokenBalancesItem[];
    preTokenBalances: SOLSerializableTransactionReceiptTokenBalancesItem[];
  };
}

export interface SerializableBlockReceipt {
  timestamp: string;
}

export type TransactionStatus = 'pending' | 'failed' | 'canceled' | 'sucesss';
export type TransactionType = 'approve' | 'swap';

export type TransactionToken = {
  networkId: string;
  token: Token;
  amount: string;
};
export interface TransactionDetails {
  hash: string;
  from: string;
  addedTime: number;
  networkId: string;
  accountId: string;
  type: TransactionType;
  status: TransactionStatus;
  archive?: boolean;
  viewed?: boolean;
  quoterType?: QuoterType;
  quoterLogo?: string;
  approval?: { tokenAddress: string; spender: string; token: Token };
  tokens?: { from: TransactionToken; to: TransactionToken; rate: number };
  receipt?: SerializableTransactionReceipt;
  swftcReceipt?: SwftcTransactionReceipt;
  confirmedTime?: number;
  receivingAccountId?: string;
  receivingAddress?: string;
  thirdPartyOrderId?: string;
  nonce?: number;
  attachment?: TransactionAttachment;
  providers?: Provider[];
  arrivalTime?: number;
  destinationTransactionHash?: string;
  percentageFee?: string;
  networkFee?: string;
  actualReceived?: string;
  protocalFees?: ProtocolFees;
}

export type TransactionProgress =
  | {
      status?: TransactionStatus;
      destinationTransactionHash?: string;
    }
  | undefined;

export type SwftcTransactionState =
  | 'wait_deposit_send'
  | 'timeout'
  | 'wait_exchange_push'
  | 'wait_receive_send'
  | 'wait_receive_confirm'
  | 'receive_complete';

export type SwftcTradeState =
  | 'wait_deposits'
  | 'complete'
  | 'exchange'
  | 'refund_complete';

export interface SwftcTransactionReceipt {
  orderId: string;
  depositCoinCode: string;
  receiveCoinAmt: string;
  depositCoinAmt: string;
  receiveCoinCode: string;
  platformAddr: string;
  detailState: SwftcTransactionState;
  tradeState: SwftcTradeState;
  instantRate: string;
  refundDepositTxid: string;
  transactionId?: string;
  dealFinishTime?: string;
}

export type ISlippageMode = 'auto' | 'preset' | 'custom';

export type ISlippageSetting = {
  mode: ISlippageMode;
  value?: string;
  autoReset?: boolean;
};

export type TokenCoingeckoType = 'stable' | 'popular' | 'others';
export type ISlippageAuto =
  | { type: TokenCoingeckoType; value?: string }
  | undefined;
export type ISlippage = { mode?: ISlippageMode; value: string };
export interface Quoter {
  type: QuoterType;
  queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress>;
}

export type ILimitOrderQuoteParams = {
  tokenOut: Token;
  tokenIn: Token;
  tokenInValue: string;
  activeAccount: Account;
};

export type LimitOrder = {
  makerToken: string;
  takerToken: string;
  makerAmount: string;
  takerAmount: string;
  takerTokenFeeAmount: string;
  maker: string;
  taker: string;
  sender: string;
  feeRecipient: string;
  pool: string;
  expiry: string;
  salt: string;
};

export type LimitOrderMetadata = {
  createdAt: string;
  orderHash: string;
  remainingFillableTakerAmount: string;
};

export type LimitOrderDetailsResponse = {
  order: LimitOrder;
  metaData: LimitOrderMetadata;
};

export interface LimitOrderTransactionDetails {
  orderHash: string;
  networkId: string;
  accountId: string;
  tokenIn: Token;
  tokenInValue: string;
  tokenOut: Token;
  tokenOutValue: string;
  remainingFillable: string;
  rate: string;
  createdAt: number;
  expiredIn: number;
  canceled?: boolean;
  limitOrder?: LimitOrder;
}

export type TokenListItem = {
  name: string;
  logoURI: string;
  networkId: string;
  fullname?: string;
  tokens: Token[];
};

export type TypedPrice = {
  reversed?: boolean;
  value: string;
};

export type ProgressStatus = {
  title?: string;
};

export type ButtonProgressContextValues = {
  progressStatus?: ProgressStatus;
  setProgressStatus?: (status: ProgressStatus) => void;
  openProgressStatus?: () => void;
  closeProgressStatus?: () => void;
};
