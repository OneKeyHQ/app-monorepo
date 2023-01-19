export interface IBaseOverviewQuery {
  networkId: string;
  address: string; // accountAddress
  xpub?: string;
}

export interface IBaseOverviewErrorInfo {
  error?: string;
  errorStack?: string;
}

export interface IOverviewScanTaskInfo
  extends IBaseOverviewQuery,
    IBaseOverviewErrorInfo {
  scanTypes?: IOverviewScanTaskType[]; // defaults to ['token']
  id?: string;
  status?: 'pending' | 'processing' | 'done';
  isFromQueueing?: boolean;

  createdTime?: string;
  startTime?: string;
  finishedTime?: string;
  runSequence?: number;
}

export type IOverviewScanTaskItem = Pick<
  IOverviewScanTaskInfo,
  'networkId' | 'address' | 'scanTypes'
>;

export type EOverviewServiceNames = string;
export type IOverviewScanTaskType = 'token' | 'defi' | 'nfts';
export interface IOverviewScanTaskPayload {
  tasks: IOverviewScanTaskInfo[];
  getNetworkTokens: (options: { networkId: string }) => Promise<ITokenInfo[]>;
}

export interface INetworkInfo {
  id: string;
  symbol: string;
  rpc: string[]; // TODO use rpcUrls
  // nativeTokenAddress?: string; // stc, aptos
}

export interface IJsonRpcRequest {
  id?: string | number;
  jsonrpc?: '2.0';
  method: string;
  params?: any[] | any;
}
export interface IJsonRpcResponse<T> {
  id?: string | number;
  jsonrpc?: '2.0';
  result: T;
  error?: any;
}

export interface IEvmContractInfo {
  contractAddress: string | undefined;
  contractAbi: any;
}

export interface ITokenInfo {
  tokenAddress: string;
  symbol?: string;
  isNative?: boolean;
}

// TODO rename ITokenBalance
export interface IToken extends IBaseOverviewQuery, ITokenInfo {
  blockHeight?: number | string; // blockHeight of this balance

  balance: string;
  balanceParsed?: string;
}

export interface IOverviewDeFiPoolTokenBalance extends ITokenInfo {
  blockHeight?: number | string;

  balance?: string;
  balanceParsed?: string;

  startBalance?: string;
  startBalanceParsed?: string;

  price?: string;
  startPrice?: string;
  invested?: string;
  fiat?: string;
  hodl?: string;

  value?: string;
  value24h: string;
}

export interface IAccountTokens extends IBaseOverviewQuery {
  tokens: IToken[];
}

export interface IOverviewServiceBaseOptions {
  requestAutoMerge?: boolean;
  requestAutoMergeDuration?: number;
}

export interface IOverviewProviderBaseOptions {
  network: INetworkInfo;
  serviceOptions?: IOverviewServiceBaseOptions;
}

export interface IOverviewDeFiProtocolInfo {
  protocolCode: string; // (project) eth_curve, eth_uniswap
  protocolName: string; // Treasure DAO
  protocolUrl: string;
  protocolIcon: string;
  protocolTags: string[]; // (service)
  protocolProxy: string;
  protocolTokenInfo?: ITokenInfo;
}

export enum OverviewDeFiPoolType {
  Pool = 'Pool',
  Locked = 'Locked',
  Farming = 'Farming',
  Liquidity = 'Liquidity',
  Staked = 'Staked',
  Deposited = 'Deposited',
  Vesting = 'Vesting',
  Governance = 'Governance',
  Lending = 'Lending',
  Borrowed = 'Borrowed',
  Rewards = 'Rewards',
}

export interface IOverviewDeFiPortfolioItem
  extends IBaseOverviewQuery,
    IOverviewDeFiProtocolInfo {
  // TODO rename serviceCode
  buildByService: EOverviewServiceNames;

  poolCode: string; // poolContractAddress, pool.id, poolId, id, lpAddress
  poolType: OverviewDeFiPoolType;
  poolName: string;
  poolUrl: string;
  volatilityType?: string; // Stable, Volatile
  apr?: string;
  pnl?: string;
  roi?: string;

  avatarToken?: IOverviewDeFiPoolTokenBalance; // lpTokenBalance
  supplyTokens: IOverviewDeFiPoolTokenBalance[]; // locked, staked, deposit, farming, liquidity pool (lp)
  rewardTokens: IOverviewDeFiPoolTokenBalance[]; // reward
  borrowTokens: IOverviewDeFiPoolTokenBalance[]; // Lending, borrow_token_list

  updateAt?: number;
  stats?: {
    assetUsdValue?: string;
    debtUsdValue?: string;
    netUsdValue?: string;
  };

  // extraInfo of Locked pool
  lockedInfo: {
    unlockTime: number | null;
  };
  vestingInfo?: {
    endTime?: number | null;
  };
  lendingInfo?: {
    healthRate?: number | null;
  };

  poolValue?: string;
}
export interface IOverviewDeFiPortfolio
  extends IBaseOverviewQuery,
    IBaseOverviewErrorInfo {
  pools: IOverviewDeFiPortfolioItem[];
  $rawServiceResult?: any;
  $scanStartTime?: string;
  $scanFinishedTime?: string;
  // TODO rename serviceCode
  buildByService: EOverviewServiceNames;
}

export interface ProjectItem {
  active_user_count_24h: number;
  chain: string;
  contract_call_count_24h: number;
  create_at?: any;
  id: string;
  is_stable: boolean;
  is_support_portfolio: boolean;
  is_tvl: boolean;
  is_visible: boolean;
  lock_underlying_usd?: any;
  lock_usd?: any;
  logo_url: string;
  name: string;
  platform_token_chain: string;
  platform_token_id: string;
  portfolio_user_count: number;
  priority: number;
  publish_at: number;
  site_url: string;
  tag_ids: string[];
  total_contract_count: number;
  total_user_count: number;
  tvl: string;
}

export type OverviewDefiRes = {
  _id: {
    networkId: string;
    address: string;
    protocolId: string;
  };
  pools: [OverviewDeFiPoolType, IOverviewDeFiPortfolioItem[]][];
  poolSize: number;
  protocolValue: string;
  protocolValue24h: string;
  claimableValue: string;
  protocolName: string;
  protocolIcon: string;
};

export enum OverviewModalRoutes {
  OverviewProtocolDetail = 'OverviewProtocolDetail',
}

export type OverviewModalRoutesParams = {
  [OverviewModalRoutes.OverviewProtocolDetail]: {
    networkId: string;
    address: string;
    protocolId: string;
    accountId: string;
  };
};
