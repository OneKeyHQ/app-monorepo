export interface IRelayChain {
  id: number;
  name: string;
  icon: string;
  vmType: string;
}

export interface IRelayCurrency {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

export interface IRelaySolverCurrency {
  chainId?: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  metadata?: {
    logoURI?: string;
  };
}

export interface IRelayQuoteRequest {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  recipient: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT';
  amount: string;
  useDepositAddress: boolean;
  refundTo: string;
}

export interface IRelayQuoteStep {
  id: string;
  action: string;
  description: string;
  depositAddress?: string;
  requestId?: string;
  items?: Array<{
    status: string;
    data?: {
      to?: string;
      depositAddress?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface IRelayQuoteResponse {
  steps: IRelayQuoteStep[];
  fees: {
    gas: {
      currency: {
        symbol: string;
        decimals: number;
      };
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
    relayer: {
      currency: {
        symbol: string;
        decimals: number;
      };
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
  };
  details: {
    sender: string;
    recipient: string;
    currencyIn: {
      currency: {
        chainId: number;
        address: string;
        symbol: string;
        name: string;
        decimals: number;
      };
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
    currencyOut: {
      currency: {
        chainId: number;
        address: string;
        symbol: string;
        name: string;
        decimals: number;
      };
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
    rate: string;
    timeEstimate: number;
    totalImpact?: {
      usd: string;
      percent: string;
    };
  };
}

export interface IRelayDepositInfo {
  depositAddress: string;
  requestId?: string;
  sendAmount: string;
  sendSymbol: string;
  receiveAmount: string;
  receiveSymbol: string;
  totalFeeUsd: string;
  totalFeePercent?: string;
  timeEstimate: number;
  maxReceiveAmount?: string;
}

export type IRelayDepositStatus =
  | 'waiting'
  | 'depositing'
  | 'pending'
  | 'submitted'
  | 'success'
  | 'refund'
  | 'failure'
  | 'unknown'
  | (string & {});

export interface IRelayDepositTx {
  hash?: string;
  type?: string;
  chainId?: number;
  timestamp?: number;
  data?: {
    from?: string;
    to?: string;
    value?: string;
    data?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface IRelayRequest {
  id?: string;
  requestId?: string;
  status?: IRelayDepositStatus;
  user?: string;
  recipient?: string;
  depositAddress?: {
    address?: string;
    depositAddressType?: string;
    depositor?: string;
  };
  data?: {
    inTxs?: IRelayDepositTx[];
    outTxs?: IRelayDepositTx[];
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
  childRequests?: IRelayRequest[];
  [key: string]: unknown;
}

export interface IRelayRequestsResponse {
  requests?: IRelayRequest[] | IRelayRequest;
  continuation?: string;
}

export interface IRelayIntentStatusResponse {
  status?: IRelayDepositStatus;
  quoteCreatedAt?: number;
  [key: string]: unknown;
}

export interface IRelayDepositStatusInfo {
  status: IRelayDepositStatus;
  requestId?: string;
  depositAddress: string;
  inTxs: IRelayDepositTx[];
  outTxs: IRelayDepositTx[];
  createdAt?: string;
  updatedAt?: string;
  quoteCreatedAt?: number;
  lastCheckedAt: number;
  request?: IRelayRequest;
  intentStatus?: IRelayIntentStatusResponse;
}

export interface IRelayChainsResponse {
  chains: Array<{
    id: number;
    name: string;
    displayName?: string;
    icon?: string;
    iconUrl?: string;
    vmType: string;
    solverCurrencies?: IRelaySolverCurrency[];
    [key: string]: unknown;
  }>;
}
