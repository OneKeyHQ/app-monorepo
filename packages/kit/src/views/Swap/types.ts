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

// token & network
export interface ISwapNetwork {
  networkId: string;
  name?: string;
  symbol?: string;
  shortcode?: string;
  logoURI?: string;
  protocol: string;
  providers: string;
}
export interface ISwapToken {
  networkId: string;
  providers: string;
  protocol: string;
  contractAddress: string; // native token ''
  symbol: string;
  decimals: number;
  logoURI?: string;
  swapSwftCode?: string;
  swapSwftUnSupportCode?: string;
}

// quote

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

export interface IFetchQuoteResult {
  info: IFetchQuoteInfo;
  toAmount: string; // quote is after protocolFees, build_tx is after protocolFees + oneKeyFee
  fee: IFetchQuoteFee;
  instantRate: string;
  allowanceResult?: IAllowanceResult;
  estimatedTime?: string;
  limit?: IFetchQuoteLimit;
}

export interface IAllowanceResult {
  allowanceTarget: string;
  amount: string;
}

export interface IFetchQuoteInfo {
  provider: string;
  providerName: string;
  providerLogo?: string;
}
export interface IFetchQuoteLimit {
  max?: string;
  min?: string;
}
export interface IFetchQuoteFee {
  percentageFee: number; // oneKey fee percentage
  protocolFees?: IFeeInfo[];
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

// build_tx
export interface IFetchBuildTxResponse {
  quoteResult: IFetchQuoteResult;
  tx?: ITransaction;
  order?: IFetchBuildTxOrderResponse;
}

export interface IEVMTransaction {
  to: string;
  value: string;
  data: string;
}

export type ITransaction = IEVMTransaction;

export interface IFetchBuildTxOrderResponse {
  platformAddr: string;
  depositCoinAmt: string;
  depositCoinCode: string;
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
