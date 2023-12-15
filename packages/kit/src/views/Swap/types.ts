export enum EExchangeProtocol {
  SWAP = 'swap',
  LIMIT = 'limit', // TODO
}

export enum ESwapProviders {
  ONE_INCH = 'swap_1inch',
  ZERO_X = 'swap_0x',
  SWFT = 'swap_swft',
  SOCKET_BRIDGE = 'swap_socket_bridge',
}

export interface ISwapToken {
  networkId: string;
  providers: string;
  protocol: string;
  contractAddress: string; // native token ''
  symbol: string;
  decimals: number;
  logoURI?: string;
  swft_coinCode?: string;
  swft_noSupportCoins?: string;
}

export interface IFetchQuotesParams {
  fromNetworkId: string;
  toNetworkId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromTokenAmount: string;
  protocol: string;
  providers: string;
  fromTokenDecimals: number;
  toTokenDecimals: number;
  fromTokenSwftCode?: string;
  toTokenSwftCode?: string;
  userAddress?: string;
  receivingAddress?: string;
  slippagePercentage?: string;
}

export interface ISwapNetwork {
  networkId: string;
  logoURI?: string;
  protocol: string;
  providers: string;
}

export type IFetchQuoteLimit = {
  max?: string;
  min?: string;
};

export interface IFetchQuoteResponse {
  quoteResult: IFetchQuoteResult;
  limit?: IFetchQuoteLimit;
}

export interface IFetchSwapResponse {
  quoteResult: IFetchQuoteResult;
  tx?: ITransaction;
  order?: IFetchSwftOrderResponse;
}

export interface IFetchQuoteFee {
  percentageFee: number; // oneKey fee percentage
  protocolFees?: IFeeInfo[];
  netWorkFees?: INetworkFee[];
}

interface IFeeTokenAsset {
  address: string;
  networkId: string;
  decimals: number;
  symbol?: string;
  logoURI?: string;
}

export interface IFeeInfo {
  amount: string;
  asset?: IFeeTokenAsset;
}

export interface INetworkFee {
  gas?: string;
  value?: IFeeInfo;
}

export interface IEVMTransaction {
  to: string;
  value: string;
  data: string;
}

export type ITransaction = IEVMTransaction;

export interface IFetchQuoteInfo {
  provider: string;
  providerName?: string;
  providerLogo?: string;
}

export interface IFetchQuoteResult {
  info: IFetchQuoteInfo;
  toAmount: string;
  finialAmount: string; // after protocolFees + oneKeyFee
  fee: IFetchQuoteFee;
  allowanceTarget?: string;
  arrivalTime?: number;
}

export interface IFetchSwftOrderResponse {
  platformAddr: string;
  depositCoinAmt: string;
  depositCoinCode: string;
  receiveCoinAmt: string;
  receiveCoinCode: string;
  orderId: string;
}

export interface IFetchResponse<T> {
  code: number;
  data: T;
  message: string;
}

// component -----------------
export interface ISwapFromAmountPercentageItem {
  label: string;
  value: number;
}
