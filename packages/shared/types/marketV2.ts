/* eslint-disable spellcheck/spell-checker */
export interface IMarketTokenDetail {
  address: string;
  logoUrl: string;
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  liquidity?: string;
  holders?: number;
  extraData?: {
    website?: string;
    twitter?: string;
  };
  price?: string;
  priceChange1mPercent?: string;
  priceChange5mPercent?: string;
  priceChange30mPercent?: string;
  priceChange1hPercent?: string;
  priceChange2hPercent?: string;
  priceChange4hPercent?: string;
  priceChange8hPercent?: string;
  priceChange24hPercent?: string;
  trade1mCount?: string;
  trade5mCount?: string;
  trade30mCount?: string;
  trade1hCount?: string;
  trade2hCount?: string;
  trade4hCount?: string;
  trade8hCount?: string;
  trade24hCount?: string;
  buy1mCount?: string;
  buy5mCount?: string;
  buy30mCount?: string;
  buy1hCount?: string;
  buy2hCount?: string;
  buy4hCount?: string;
  buy8hCount?: string;
  buy24hCount?: string;
  sell1mCount?: string;
  sell5mCount?: string;
  sell30mCount?: string;
  sell1hCount?: string;
  sell2hCount?: string;
  sell4hCount?: string;
  sell8hCount?: string;
  sell24hCount?: string;
  uniqueWallet1m?: string;
  uniqueWallet5m?: string;
  uniqueWallet30m?: string;
  uniqueWallet1h?: string;
  uniqueWallet2h?: string;
  uniqueWallet4h?: string;
  uniqueWallet8h?: string;
  uniqueWallet24h?: string;
  volume1m?: string;
  volume5m?: string;
  volume30m?: string;
  volume1h?: string;
  volume2h?: string;
  volume4h?: string;
  volume8h?: string;
  volume24h?: string;
  volume1hChangePercent?: string;
  volume2hChangePercent?: string;
  volume4hChangePercent?: string;
  volume8hChangePercent?: string;
  volume24hChangePercent?: string;
  vBuy5m?: string;
  vBuy30m?: string;
  vBuy1h?: string;
  vBuy2h?: string;
  vBuy4h?: string;
  vBuy8h?: string;
  vBuy24h?: string;
  vSell1m?: string;
  vSell5m?: string;
  vSell30m?: string;
  vSell1h?: string;
  vSell2h?: string;
  vSell4h?: string;
  vSell8h?: string;
  vSell24h?: string;
  [key: string]: unknown;
}

export interface IMarketTokenDetailAttribute {
  labelKey: string;
  value: string;
}

export interface IMarketChain {
  networkId: string;
  name: string;
  logoUrl: string;
  explorerUrl: string;
}

export interface IMarketChainsResponse {
  list: IMarketChain[];
  total: number;
}

export interface IMarketTokenListItemExtraData {
  website?: string;
  twitter?: string;
  [key: string]: unknown;
}

export interface IMarketTokenListItem {
  address: string;
  logoUrl?: string;
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  holders?: number;
  extraData?: IMarketTokenListItemExtraData;
  price?: string;
  priceChange1mPercent?: string;
  priceChange5mPercent?: string;
  priceChange30mPercent?: string;
  priceChange1hPercent?: string;
  priceChange2hPercent?: string;
  priceChange4hPercent?: string;
  priceChange8hPercent?: string;
  priceChange24hPercent?: string;
  trade1mCount?: string;
  trade5mCount?: string;
  trade30mCount?: string;
  trade1hCount?: string;
  trade2hCount?: string;
  trade4hCount?: string;
  trade8hCount?: string;
  trade24hCount?: string;
  buy1mCount?: string;
  buy5mCount?: string;
  buy30mCount?: string;
  buy1hCount?: string;
  buy2hCount?: string;
  buy4hCount?: string;
  buy8hCount?: string;
  buy24hCount?: string;
  sell1mCount?: string;
  sell5mCount?: string;
  sell30mCount?: string;
  sell1hCount?: string;
  sell2hCount?: string;
  sell4hCount?: string;
  sell8hCount?: string;
  sell24hCount?: string;
  uniqueWallet1m?: string;
  uniqueWallet5m?: string;
  uniqueWallet30m?: string;
  uniqueWallet1h?: string;
  uniqueWallet2h?: string;
  uniqueWallet4h?: string;
  uniqueWallet8h?: string;
  uniqueWallet24h?: string;
  volume1m?: string;
  volume5m?: string;
  volume30m?: string;
  volume1h?: string;
  volume2h?: string;
  volume4h?: string;
  volume8h?: string;
  volume24h?: string;
  volume1hChangePercent?: string;
  volume2hChangePercent?: string;
  volume4hChangePercent?: string;
  volume8hChangePercent?: string;
  volume24hChangePercent?: string;
  networkId?: string;
  liquidity?: string;
  chainId?: string;
}

export interface IMarketTokenListResponse {
  list: IMarketTokenListItem[];
  total: number;
}

export interface IMarketTokenKLineDataPoint {
  o: number; // open price
  h: number; // high price
  l: number; // low price
  c: number; // close price
  v: number; // volume
  t: number; // timestamp
}

export interface IMarketTokenKLineResponse {
  points: IMarketTokenKLineDataPoint[];
  total: number;
}

export interface IMarketTokenTransactionToken {
  symbol: string;
  amount: string;
  address: string;
  price: string;
}

export interface IMarketTokenTransaction {
  pairAddress: string;
  hash: string;
  owner: string;
  type: 'buy' | 'sell';
  timestamp: number;
  url: string;
  from: IMarketTokenTransactionToken;
  to: IMarketTokenTransactionToken;
}

export interface IMarketTokenTransactionsResponse {
  list: IMarketTokenTransaction[];
}

export interface IMarketTokenHolder {
  accountAddress: string;
  amount: string;
  fiatValue: string;
  /**
   * Percentage of the total token supply that this holder owns. The value is expressed as a string
   * representation of the percentage (e.g. "10.31" to represent 10.31%).
   */
  percentage?: string;
}

export interface IMarketTokenHoldersResponse {
  list: IMarketTokenHolder[];
}

export interface IMarketTokenBatchListResponse {
  list: IMarketTokenListItem[];
}

export interface IMarketTokenSecurityItem {
  value: boolean | number | string;
  content: string;
}

// GoPlus Security API - EVM Token Security Data
export interface IMarketTokenSecurityEVMData {
  buy_tax: IMarketTokenSecurityItem; // 买入税率 (0 = 无税)
  can_take_back_ownership: IMarketTokenSecurityItem; // 可收回所有权
  cannot_buy: IMarketTokenSecurityItem; // 禁止买入
  cannot_sell_all: IMarketTokenSecurityItem; // 禁止全部卖出
  creator_percent: IMarketTokenSecurityItem; // 创建者持币比例
  external_call: IMarketTokenSecurityItem; // 外部合约调用
  hidden_owner: IMarketTokenSecurityItem; // 是否隐藏拥有者
  honeypot_with_same_creator: IMarketTokenSecurityItem; // 是否蜜罐（同创建者）
  is_anti_whale: IMarketTokenSecurityItem; // 是否反巨鲸机制
  is_blacklisted: IMarketTokenSecurityItem; // 黑名单机制
  is_honeypot: IMarketTokenSecurityItem; // 是否为蜜罐
  is_mintable: IMarketTokenSecurityItem; // 是否可增发
  is_open_source: IMarketTokenSecurityItem; // 是否开源
  is_proxy: IMarketTokenSecurityItem; // 是否代理合约
  is_whitelisted: IMarketTokenSecurityItem; // 白名单机制
  owner_address: IMarketTokenSecurityItem; // 合约所有者地址
  owner_change_balance: IMarketTokenSecurityItem; // 是否可修改余额
  owner_percent: IMarketTokenSecurityItem; // 所有者持币占比
  personal_slippage_modifiable: IMarketTokenSecurityItem; // 用户滑点可调整
  selfdestruct: IMarketTokenSecurityItem; // 是否支持自毁
  sell_tax: IMarketTokenSecurityItem; // 卖出税率
  slippage_modifiable: IMarketTokenSecurityItem; // 滑点参数可修改
  trading_cooldown: IMarketTokenSecurityItem; // 是否启用交易冷却
  transfer_pausable: IMarketTokenSecurityItem; // 是否可暂停转账
  transfer_tax: IMarketTokenSecurityItem; // 转账税率
  trust_list: IMarketTokenSecurityItem; // 信任列表机制
}

// GoPlus Security API - Solana Token Security Data
export interface IMarketTokenSecuritySolanaData {
  is_balance_mutable_authority: IMarketTokenSecurityItem; // 是否有余额修改权限
  closable: IMarketTokenSecurityItem; // 是否有可关闭账户权限
  default_account_state: IMarketTokenSecurityItem; // 是否有默认账户状态
  freezable: IMarketTokenSecurityItem; // 是否有冻结账户权限
  metadata_mutable: IMarketTokenSecurityItem; // 是否有元数据是否可变
  is_metadata_upgrade_authority: IMarketTokenSecurityItem; // 是否有元数据升级权限
  mintable: IMarketTokenSecurityItem; // 是否有增发权限
  non_transferable: IMarketTokenSecurityItem; // 是否有不可转账权限
  transfer_fee: IMarketTokenSecurityItem; // 是否有转账手续费
  transfer_fee_upgradable: IMarketTokenSecurityItem; // 是否有转账手续费升级权限
  transfer_hook: IMarketTokenSecurityItem; // 是否有转账钩子
  transfer_hook_upgradable: IMarketTokenSecurityItem; // 是否有转账钩子升级权限
  trusted_token: IMarketTokenSecurityItem; // 是否有可信代币权限
}

// GoPlus Security API - Sui Token Security Data
export interface IMarketTokenSecuritySuiData {
  is_blacklisted: IMarketTokenSecurityItem; // 是否被列入黑名单
  is_contract_upgradeable: IMarketTokenSecurityItem; // 是否可升级合约
  is_metadata_modifiable: IMarketTokenSecurityItem; // 是否可修改元数据
  is_mintable: IMarketTokenSecurityItem; // 是否可增发
  is_trusted_token: IMarketTokenSecurityItem; // 是否为可信代币
  blacklist_cap_owner: IMarketTokenSecurityItem; // 黑名单所有者
  contract_upgradeable_cap_owner: IMarketTokenSecurityItem; // 合约升级所有者
  metadata_modifiable_cap_owner: IMarketTokenSecurityItem; // 元数据修改所有者
  mintable_cap_owner: IMarketTokenSecurityItem; // 增发所有者
}

// Union type for all supported token security data formats
export type IMarketTokenSecurityData =
  | IMarketTokenSecurityEVMData
  | IMarketTokenSecuritySolanaData
  | IMarketTokenSecuritySuiData;

export interface IMarketTokenSecurityBatchResponse {
  [tokenAddress: string]: IMarketTokenSecurityData;
}

export interface IMarketBasicConfigNetwork {
  networkId: string;
  index: number;
  name: string;
  logoUrl: string;
  explorerUrl: string;
  chainId: string;
}

export interface IMarketBasicConfigToken {
  contractAddress: string;
  chainId: string;
  isNative: boolean;
  name: string;
}

export interface IMarketBasicConfigData {
  networkList: IMarketBasicConfigNetwork[];
  recommendTokens: IMarketBasicConfigToken[];
  refreshInterval: number;
  minLiquidity: number;
}

export interface IMarketBasicConfigResponse {
  code: number;
  message: string;
  data: IMarketBasicConfigData;
}
