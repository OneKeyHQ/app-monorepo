import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type {
  IDecodedTx,
  IEncodedTx,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import type { SendConfirmParams } from '@onekeyhq/kit/src/views/Send/types';

import type { SendConfirmPayloadBase } from '../Send/types';

export enum SwapRoutes {
  Swap = 'Swap',
  Input = 'Input',
  Output = 'Output',
  Settings = 'Settings',
  CustomToken = 'CustomToken',
  Transaction = 'Transaction',
  Webview = 'Webview',
  Share = 'Share',
  SwftcHelp = 'SwftcHelp',
  PickRecipient = 'PickRecipient',
  PickAccount = 'PickAccount',
  EnterAddress = 'EnterAddress',
  Welcome = 'Welcome',
  SelectRoutes = 'SelectRoutes',
  Send = 'Send',
  Slippage = 'Slippage',
  SlippageCheck = 'SlippageCheck',
}

export type SwapRoutesParams = {
  [SwapRoutes.Swap]: undefined;
  [SwapRoutes.Input]: undefined;
  [SwapRoutes.Output]: undefined;
  [SwapRoutes.Settings]: undefined;
  [SwapRoutes.Webview]: { url: string };
  [SwapRoutes.SwftcHelp]: { orderid: string };
  [SwapRoutes.PickAccount]:
    | {
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
  [SwapRoutes.EnterAddress]:
    | {
        networkId?: string;
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
  [SwapRoutes.Send]: {
    accountId: string;
    networkId: string;
    encodedTx: IEncodedTx;
    payload?: SendConfirmParams['payloadInfo'];
    onSuccess?: (result: ISignedTxPro, data: IDecodedTx) => void;
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
  contractAddress: string;
  transactionIndex: number;
  blockHash: string;
  transactionHash: string;
  blockNumber: number;
  status?: string;
  logs?: TransactionLog[];
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

export type SwftcTradeState = 'wait_deposits' | 'complete' | 'exchange';

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
  prepare?: () => void;
  isSupported(networkA: Network, networkB: Network): boolean;
  fetchQuote(params: FetchQuoteParams): Promise<FetchQuoteResponse | undefined>;
  buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined>;
  queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress>;
}
