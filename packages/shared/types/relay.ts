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

export interface IRelayQuoteRequest {
  user: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  recipient: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  amount: string;
  useDepositAddress: boolean;
  refundTo: string;
}

export interface IRelayQuoteStep {
  id: string;
  action: string;
  description: string;
  depositAddress?: string;
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
  };
}

export interface IRelayDepositInfo {
  depositAddress: string;
  sendAmount: string;
  sendSymbol: string;
  receiveAmount: string;
  receiveSymbol: string;
  totalFeeUsd: string;
  timeEstimate: number;
}

export interface IRelayChainsResponse {
  chains: Array<{
    id: number;
    name: string;
    icon: string;
    vmType: string;
    solverCurrencies?: Array<{
      chainId: number;
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoURI: string;
    }>;
    [key: string]: unknown;
  }>;
}
