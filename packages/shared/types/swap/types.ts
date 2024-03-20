export enum EProtocolOfExchange {
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

export enum ESwapDirectionType {
  FROM = 'from',
  TO = 'to',
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
  contractAddress: string;
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
  networkLogoURI?: string;
  swapSwftCode?: string;
  swapSwftUnSupportCode?: string;
  balance?: string;
  balanceParsed?: string;
  price: number;
  price24h?: number;
  fiatValue?: string;
  accountAddress?: string;
  isNative?: boolean;
}

export interface ISwapTokenCatch {
  data: ISwapToken[];
  updatedAt: number;
}

export interface ISwapTokenDetailInfo {
  price: string;
  balance: string;
  balanceParsed: string;
  fiatValue: string;
}

export interface IFetchTokensParams {
  type: ESwapDirectionType;
  networkId?: string;
  keywords?: string;
  fromToken?: ISwapToken;
  limit?: number;
  next?: string;
  accountAddress?: string;
  accountNetworkId?: string;
  accountXpub?: string;
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
  fromTokenIsNative?: boolean;
  toTokenIsNative?: boolean;
}
interface ISocketAsset {
  address: string;
  chainId: number;
  decimals: number;
  icon: string;
  logoURI: string;
  name: string;
  symbol: string;
}
interface ISocketRewardData {
  amount: string;
  amountInUsd: number;
  asset: ISocketAsset;
  chainId: number;
}
export interface ISocketExtraData {
  rewards: ISocketRewardData[];
}
interface IQuoteExtraData {
  socketBridgeExtraData?: ISocketExtraData;
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
  quoteExtraData?: IQuoteExtraData;
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
  protocolFees?: number;
  estimatedFeeFiatValue?: number;
}

export enum ESwapApproveAllowanceType {
  UN_LIMIT = 'unLimit',
  PRECISION = 'precision',
}

export enum ESwapFetchCancelCause {
  SWAP_TOKENS_CANCEL = 'SWAP_TOKENS_CANCEL',
  SWAP_QUOTE_CANCEL = 'SWAP_QUOTE_CANCEL',
}

// swap action&alert state
export interface ISwapState {
  label: string;
  isLoading: boolean;
  isWrapped?: boolean;
  isApprove?: boolean;
  disabled: boolean;
  isCrossChain: boolean;
  shoutResetApprove?: boolean;
  approveUnLimit?: boolean;
  alerts?: ISwapAlertState[];
}

export enum ESwapAlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}
export interface ISwapAlertState {
  message?: string;
  alertLevel?: ESwapAlertLevel;
  inputShowError?: boolean;
  cb?: () => void;
  cbLabel?: string;
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

export interface ISwapInfoSide {
  amount: string;
  token: ISwapToken;
}
export interface ISwapTxInfo {
  sender: ISwapInfoSide;
  receiver: ISwapInfoSide;
  accountAddress: string;
  receivingAddress: string;
  swapBuildResData: IFetchBuildTxResponse;
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
  gasFee?: string;
  gasFeeFiatValue?: string;
  timestamp?: number;
  dealReceiveAmount?: string;
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
    orderId?: string;
    sender: string;
    receiver: string;
    gasFeeInNative?: string;
    gasFeeFiatValue?: string;
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
  AUTO = 'Auto',
  CUSTOM = 'Custom',
}

export enum ESwapSlippageCustomStatus {
  NORMAL = 'normal',
  ERROR = 'error',
  WRONG = 'wrong',
}
