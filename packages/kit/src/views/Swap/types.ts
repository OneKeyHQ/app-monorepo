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

export enum ESwapReceiveAddressType {
  USER_ACCOUNT = 'user_account',
  INPUT = 'input',
  ADDRESS_BOOK = 'address_book',
}

// token & network
export interface ISwapNetwork {
  networkId: string;
  name?: string;
  symbol?: string;
  shortcode?: string;
  logoURI?: string;
  protocol: string;
  explorer?: string; // '..../{transaction}' need replace {transaction} to txId
}
export interface ISwapToken {
  networkId: string;
  providers: string;
  protocol: string;
  contractAddress: string; // native token ''
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
  swapSwftCode?: string;
  swapSwftUnSupportCode?: string;
  balance?: string;
  balanceParsed?: string;
  price: number;
  price24h?: number;
  fiatValue?: string;
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
  slippagePercentage?: number;
}

export interface IFetchQuoteResult {
  info: IFetchQuoteInfo;
  toAmount: string; // quote is after protocolFees, build_tx is after protocolFees + oneKeyFee
  fee: IFetchQuoteFee;
  instantRate: string;
  allowanceResult?: IAllowanceResult;
  estimatedTime?: string;
  isBest?: boolean;
  limit?: IFetchQuoteLimit;
  isWrapped?: boolean;
  unSupportReceiveAddressDifferent?: boolean;
}

export interface IAllowanceResult {
  allowanceTarget: string;
  amount: string;
  shouldResetApprove?: boolean;
}

export interface IFetchQuoteInfo {
  provider: ESwapProviders;
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

// swap action state
export enum ESwapStepStateType {
  PRE = 'pre', // no select token & no input fromAmount
  QUOTE = 'quote',
  ACCOUNT_CHECK = 'account_check', // check account connect & balance
  APPROVE = 'approve', // need approve
  BUILD_TX = 'build_tx', // build tx
}

export interface ISwapStepState {
  type: ESwapStepStateType;
  isLoading: boolean;
  isWrapped?: boolean;
  disabled: boolean;
  isCrossChain: boolean;
  wrongMsg?: string;
  rateWarning?: string;
}

// build_tx

export interface IFetchBuildTxResult extends IFetchQuoteResult {
  arrivalTime?: number;
}

export interface IFetchBuildTxResponse {
  result: IFetchBuildTxResult;
  tx?: ITransaction;
  swftOrder?: IFetchBuildTxOrderResponse;
  ctx?: any;
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

// tx history

export enum ESwapTxHistoryStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

export interface IFetchSwapTxHistoryStatusResponse {
  state: ESwapTxHistoryStatus;
  crossChainReceiveTxHash?: string;
}
export interface ISwapTxHistory {
  status: ESwapTxHistoryStatus;
  ctx?: any;
  baseInfo: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromAmount: string;
    toAmount: string;
    fromNetwork?: ISwapNetwork;
    toNetwork?: ISwapNetwork;
  };
  txInfo: {
    txId: string;
    sender: string;
    receiver: string;
    netWorkFee?: string;
    receiverTransactionId?: string;
  };
  swapInfo: {
    provider: IFetchQuoteInfo;
    instantRate: string;
    protocolFee?: number;
    oneKeyFee?: number;
  };
  date: {
    created: number;
    updated: number;
  };
}

// component -----------------
export interface ISwapFromAmountPercentageItem {
  label: string;
  value: number;
}

export interface ISwapSlippageSegmentItem {
  key: ESwapSlippageSegmentKey;
  value: number;
}

export enum ESwapSlippageSegmentKey {
  AUTO = 'auto',
  CUSTOM = 'custom',
  ZERO_ONE = '0.1',
  ZERO_FIVE = '0.5',
  ONE = '1',
}
