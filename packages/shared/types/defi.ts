import type { ICurrencyItem } from './currency';

export type IDeFiUnknownRecord = Record<string, unknown>;

export type IFetchAccountDeFiPositionsParams = {
  accountId: string;
  indexedAccountId?: string;
  networkId: string;
  accountAddress?: string;
  xpub?: string;
  isAllNetworks?: boolean;
  allNetworksAccountId?: string;
  allNetworksNetworkId?: string;
  saveToLocal?: boolean;
  excludeLowValueProtocols?: boolean;
  lowValueProtocolsThresholdUsd?: number;
  sourceCurrencyInfo?: ICurrencyItem;
  targetCurrencyInfo?: ICurrencyItem;
  isForceRefresh?: boolean;
  // When false, the request is NOT registered with the shared abort pool and
  // will not be cancelled by abortFetchAccountDeFiPositions(). Use for
  // background schedulers whose fetches should survive UI-initiated aborts.
  abortable?: boolean;
};

export enum EDeFiAssetType {
  ASSET = 'asset',
  DEBT = 'debt',
  REWARD = 'reward',
}

export type IDeFiAssetMeta = {
  decimals: number;
  logoUrl?: string;
  isVerified: boolean;
};

export type IDeFiProxyDetail = {
  project?: {
    id?: string;
    name?: string;
  } & IDeFiUnknownRecord;
  proxyContractId?: string;
} & IDeFiUnknownRecord;

export type IDeFiActionExtraParams = {
  poolAddress?: string;
  groupId?: string;
  rewards?: { tokenAddress: string; amount: string; proofs: string[] }[];
  tokenId?: string;
  amount0Min?: string;
  amount1Min?: string;
  deadline?: number;
  currency0?: string;
  currency1?: string;
  signature?: string;
} & IDeFiUnknownRecord;

export type IDeFiContracts = {
  pool?: string;
  poolAddress?: string;
} & IDeFiUnknownRecord;

export type IDeFiAsset = {
  symbol: string;
  address: string;
  amount: string;
  value: number;
  price: number;
  category: string;
  meta: IDeFiAssetMeta;
  contracts?: IDeFiContracts;
  extraParams?: IDeFiActionExtraParams;
  poolAddress?: string;
  tokenId?: string;
  currency0?: string;
  currency1?: string;
  proxyDetail?: IDeFiProxyDetail;
};

export type IMetrics = {
  healthFactor: number | null;
};

export type IDeFiSource = {
  provider: string;
  fetchedAt: string;
  ttl: number;
  cached: boolean;
};

export type IDeFiPosition = {
  networkId: string;
  owner: string;
  protocol: string;
  protocolName: string;
  chain: string;
  category: string;
  assets: IDeFiAsset[];
  debts: IDeFiAsset[];
  rewards: IDeFiAsset[];
  metrics: IMetrics;
  source: IDeFiSource;
  groupId: string;
  name: string;
  contracts?: IDeFiContracts;
  extraParams?: IDeFiActionExtraParams;
  poolAddress?: string;
  tokenId?: string;
  currency0?: string;
  currency1?: string;
  proxyDetail?: IDeFiProxyDetail;
};

export type IProtocolSummary = {
  protocol: string;
  protocolName: string;
  totalValue: number;
  totalDebt: number;
  totalReward: number;
  netWorth: number;
  networkIds: string[];
  positionCount: number;
  positionIndices: { index: number; networkId: string }[];
  protocolLogo: string;
  protocolUrl: string;
};

export type IFetchAccountDeFiPositionsResp = {
  success: boolean;
  data: {
    positions: Record<string, IDeFiPosition[]>; // <networkId, positions>
    totals: {
      totalValue: number;
      totalDebt: number;
      totalReward: number;
      netWorth: number;
      chains: string[];
      protocolCount: number;
      positionCount: number;
    };
    protocolSummaries: IProtocolSummary[];
  };
  meta: {
    provider: string;
    networkIds: string[];
    canonicalChains: string[];
    requestedNetworkIds: string[];
    requestedCanonicalChains: string[];
    fetchedAt: string;
    staleness: number;
    freshnessSec: number;
    cached: boolean;
    degraded: boolean;
    warnings: string[];
  };
};

export type IDeFiProtocol = {
  accountId?: string;
  indexedAccountId?: string;
  networkId: string;
  owner: string;
  protocol: string; // as protocolId
  categories: string[];
  positions: {
    category: string;
    assets: (IDeFiAsset & { type: EDeFiAssetType })[];
    debts: (IDeFiAsset & { type: EDeFiAssetType })[];
    rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
    value: string;
    groupId: string;
    poolName: string;
    poolFullName: string;
    sourcePositions?: IDeFiPosition[];
    proxyDetail?: IDeFiProxyDetail;
  }[];
};

export enum EDeFiPositionAction {
  Withdraw = 'withdraw',
  Repay = 'repay',
  Claim = 'claim',
  ClaimWithdrawal = 'claimWithdrawal',
  Permit = 'permit',
  RemoveLiquidity = 'removeLiquidity',
}

export type IDeFiSupportedProtocolAction = {
  protocolId: string;
  networkId: string;
  positionCategory: string;
  assetCategory?: string;
  debtCategory?: string;
  rewardCategory?: string;
  action: EDeFiPositionAction;
};

export type IGetSupportedDeFiProtocolsResp = {
  protocols: IDeFiSupportedProtocolAction[];
};

export type IDeFiEvmTransaction = {
  from: string;
  to: string;
  data: string;
  value?: string;
};

export type IDeFiBuildTransactionParams = {
  accountId: string;
  networkId: string;
  protocolId: string;
  action: EDeFiPositionAction;
  tokenAddress?: string;
  amount?: string;
  bps?: string;
  extraParams?: IDeFiActionExtraParams;
};

export type IDeFiBuildTransactionResp = {
  tx?: IDeFiEvmTransaction;
  approvalTx?: IDeFiEvmTransaction;
  permit?: {
    message: unknown;
    deadline: number;
  };
};

export type IDeFiActionTxConfirmInfo = {
  actionLabel: string;
  protocolId: string;
  assetAmount: string;
  assetSymbol: string;
  assetLogoUrl?: string;
  extraLabel?: string;
};

export type IResolvedDeFiPositionActionAsset = {
  asset: IDeFiAsset;
  underlyingAssets?: IDeFiAsset[];
  tokenAddress?: string;
  amount: string;
  symbol: string;
  extraParams?: IDeFiActionExtraParams;
};

export type IResolvedDeFiPositionAction = {
  action: EDeFiPositionAction;
  protocolId: string;
  networkId: string;
  positionCategory: string;
  assetCategory?: string;
  debtCategory?: string;
  rewardCategory?: string;
  assets: IResolvedDeFiPositionActionAsset[];
};
