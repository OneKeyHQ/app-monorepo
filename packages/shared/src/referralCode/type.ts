export interface IRewardToken {
  networkId: string;
  address: string;
  logoURI: string;
  name: string;
  symbol: string;
}

interface IRewardBalance {
  token: IRewardToken;
  amount: string;
  fiatValue: string;
  usdValue: string;
}

interface IReward {
  title: string;
  description: string;
  monthlySales?: string;
  monthlySalesFiatValue?: string;
  available?: IRewardBalance[];
  pending?: IRewardBalance[];
  perp?: IRewardBalance[];
}

export interface IWithdrawAddress {
  _id: string;
  networkId: string;
  userId: string;
  __v: number;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface IInviteSummary {
  faqs: Array<{
    q: string;
    a: string;
  }>;
  inviteUrl: string;
  inviteCode: string;
  isSuspended?: boolean;
  suspensionNotice?: string;
  suspensionContactLabel?: string;
  withdrawAddresses: IWithdrawAddress[];
  enabledNetworks: string[];
  totalRewards: string;
  levelPercent: string;
  nextRebateLevel?: string;
  Onchain: IReward;
  rebateConfig: {
    level: number;
    emoji: string;
    icon: string;
    rebate: number;
    discount: number;
    threshold: number;
    thresholdFiatValue: string;
    labelKey: string;
    label: string;
    configs?: Record<string, IInviteLevelCommissionRate>;
  };
  rebateLevels: {
    level: number;
    rebate: number;
    discount: number;
    threshold: number;
    thresholdFiatValue: string;
    emoji: string;
    icon: string;
    labelKey: string;
    label: string;
    configs?: Record<string, IInviteLevelCommissionRate>;
  }[];
  HardwareSales: IReward & {
    nextStage: {
      isEnd: boolean;
      percent: string;
      amount: string;
      label: string;
    };
  };
  Earn?: Record<string, any>;
  banners: any[];
  cumulativeRewards: IHardwareCumulativeRewards;
}

export interface IEarnWalletHistoryItem {
  networkId: string;
  address: string;
  createdAt: string;
}

export interface IEarnWalletHistoryNetwork {
  networkId: string;
  name: string;
  logoURI: string;
}

export interface IEarnWalletHistory {
  items: {
    items: IEarnWalletHistoryItem[];
    total: number;
  }[];
  networks: IEarnWalletHistoryNetwork[];
  total: number;
}

interface IHardwareSalesRecordItem {
  _id: string;
  itemUniqueId: string;
  side: 'in' | 'out';
  subject: string;
  userId: string;
  createdAt: string;
  effectiveTime: string | null;
  orderTotalAmount: string;
  payReceipt: string | null;
  payTime: string | null;
  orderName: string | null;
  source: string | null;
  receivceAddress: string | null;
  heading: string;
  title: string;
  token: {
    networkId: string;
    address: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
  updatedAt: string;
  fiatValue: string;
  status: string;
}

export interface IEarnRewardItem {
  amount: string;
  networkId: string;
  token: {
    networkId: string;
    address: string;
    name: string;
    logoURI: string;
    symbol: string;
  };
  vaultName: string;
  vaultAddress: string;
  provider: string;
  fiatValue: string;
}

export interface IEarnRewardResponse {
  fiatValue: string;
  items: {
    accountAddress: string;
    fiatValue: string;
    items: IEarnRewardItem[];
  }[];
  total: number;
}

export interface IPerpsRecordItemDetail {
  token: IRewardToken;
  amount: string;
  amountFiatValue: string;
  tradingVolume: string;
  tradingVolumeFiatValue: string;
}

export interface IPerpsRecordItem {
  accountAddress: string;
  fiatValue: string;
  items: IPerpsRecordItemDetail[];
}

export interface IPerpsRecordsResponse {
  fiatValue: string;
  items: IPerpsRecordItem[];
  total: number;
}

export interface IPerpsInviteItem {
  _id: string;
  address: string;
  invitationTime: string;
  inviteCode: string;
  inviteCodeRemark: string;
  firstTradeTime: string;
  volume: string;
  volumeFiatValue: string;
  fee: string;
  feeFiatValue: string;
  reward: string;
  rewardFiatValue: string;
  hasUndistributed: boolean;
  token: IRewardToken;
}

export interface IPerpsInvitesResponse {
  total: number;
  cursor: string | null;
  items: IPerpsInviteItem[];
}

export type IPerpsInvitesSortBy =
  | 'volume'
  | 'fee'
  | 'reward'
  | 'invitationTime'
  | 'firstTradeTime';

export type IPerpsInvitesSortOrder = 'asc' | 'desc';

export interface IPerpsInvitesParams {
  tab: 'undistributed' | 'total';
  timeRange?: EExportTimeRange;
  startTime?: number;
  endTime?: number;
  inviteCode?: string;
  hideZeroVolume?: boolean;
  sortBy?: IPerpsInvitesSortBy;
  sortOrder?: IPerpsInvitesSortOrder;
  cursor?: string;
}

export interface IEarnPositionItem {
  key: string;
  networkId: string;
  accountAddress: string;
  deposited: string;
}

export interface IEarnProtocol {
  networkId: string;
  symbol: string;
  provider: string;
  vault: string;
}

export interface IEarnPositionsResponse {
  list: IEarnPositionItem[];
  protocols: Record<string, IEarnProtocol>;
}
export interface IHardwareSalesRecord {
  available: {
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
    amount: string;
    fiatValue: string;
  };
  pending: {
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
    amount: string;
    fiatValue: string;
  };
  items: IHardwareSalesRecordItem[];
}

export interface IInvitePaidItem {
  _id: string;
  networkId: string;
  address: string;
  token: {
    networkId: string;
    address: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
  version: number;
  rebateAmount: string;
  tx: string;
  updatedAt: string;
  createdAt: string;
  paidAmount: string;
}

export interface IInvitePaidHistory {
  total: number;
  items: IInvitePaidItem[];
}

export interface IInviteHistory {
  total: number;
  items: IHardwareSalesRecordItem[];
}

export interface IInvitePostConfig {
  referralReward: {
    amount: number;
    unit: string;
  };
  commissionRate: {
    amount: number;
    unit: string;
  };
  friendDiscount: {
    amount: number;
    unit: string;
  };
  inviteeDiscount: {
    amount: number;
    unit: string;
  };
  inviterRebate: {
    amount: number;
    unit: string;
  };
  theirDiscount: {
    amount: number;
    unit: string;
  };
  locales: {
    Earn: {
      title: string;
      subtitle: string;
      for_you: {
        title: string;
        subtitle: string;
      };
      for_your_friend: {
        title: string;
        subtitle: string;
      };
    };
    Perps?: {
      title: string;
      subtitle: string;
      for_you: {
        title: string;
        subtitle: string;
      };
      for_your_friend: {
        title: string;
        subtitle: string;
      };
    };
  };
}

export interface IInviteLevelProgressMeta {
  current: string;
  currentFiatValue: string;
  threshold: string;
  thresholdFiatValue: string;
  progress: string;
  labelKey?: string;
  label?: string;
  commissionRatesLabelKey?: string;
  commissionRatesLabel?: string;
  levelUpLabelKey?: string;
  levelUpLabel?: string;
}

export interface IInviteLevelUpgradeCondition {
  subject: string;
  current: string;
  currentFiatValue: string;
  threshold: string;
  thresholdFiatValue: string;
  progress: string;
  labelKey?: string;
  label?: string;
  commissionRatesLabelKey?: string;
  commissionRatesLabel?: string;
  levelUpLabelKey?: string;
  levelUpLabel?: string;
}

export interface IInviteLevelCommissionRate {
  rebate: number;
  discount: number;
  enabled: boolean;
  hasThreshold: boolean;
  threshold?: number;
  labelKey?: string;
  label?: string;
  commissionRatesLabelKey?: string;
  commissionRatesLabel?: string;
  levelUpLabelKey?: string;
  levelUpLabel?: string;
}

export interface IInviteLevelItem {
  level: number;
  icon: string;
  emoji: string;
  labelKey: string;
  label: string;
  isCurrent: boolean;
  upgradeConditions: IInviteLevelUpgradeCondition[];
  commissionRates:
    | Record<string, IInviteLevelCommissionRate>
    | IInviteLevelCommissionRate[];
}

export interface IInviteLevelDetail {
  currentLevel: number;
  levelProgress:
    | Record<string, IInviteLevelProgressMeta>
    | IInviteLevelProgressMeta[];
  levels: IInviteLevelItem[];
}

export interface IInviteCodeItem {
  userId: string;
  code: string;
  note: string;
  isPrimary: boolean;
  _id: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface IInviteCodeListItem {
  userId: string;
  code: string;
  note: string;
  isPrimary: boolean;
  createdAt: string;
  createdDate: string;
  salesOrders: number;
  onchainWallets: number;
  cumulativeRewards: string;
  cumulativeRewardsFiatValue: string;
  inviteUrl: string;
}

export interface IInviteCodeListResponse {
  items: IInviteCodeListItem[];
  total: number;
  maxCodes: number;
  remainingCodes: number;
}

export interface IUpdateInviteCodeNoteResponse {
  success: boolean;
}

// Export functionality types
export enum EExportSubject {
  HardwareSales = 'HardwareSales',
  Onchain = 'Onchain',
  Perp = 'Perp',
}

export enum EExportTimeRange {
  All = 'all',
  OneMonth = '1month',
  ThreeMonths = '3months',
  SixMonths = '6months',
  Custom = 'custom',
}

export enum EExportTab {
  Earn = 'Earn',
  Perp = 'Perp',
}

export interface IExportInviteDataParams {
  subject: EExportSubject;
  timeRange: EExportTimeRange;
  inviteCode?: string;
  tab?: EExportTab;
  startTime?: number;
  endTime?: number;
}

// API returns CSV string directly
export type IExportInviteDataResponse = string;

// Hardware cumulative rewards response
export interface IHardwareCumulativeRewards {
  distributed: string;
  undistributed: string;
  pending: string;
  nextDistribution: string;
  token: {
    networkId: string;
    address: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
}

// Perps Invitee Reward Types
export interface IPerpsInviteeRewardToken {
  address: string;
  logoURI: string;
  name: string;
  networkId: string;
  symbol: string;
}

export interface IPerpsInviteeRewardHistoryItem {
  amount: string;
  date: string;
  tx: string;
}

export interface IPerpsInviteeRewardsResponse {
  history: IPerpsInviteeRewardHistoryItem[];
  token: IPerpsInviteeRewardToken;
  totalBonus: string;
  undistributed: string;
}

// Batch check wallet bound referral code types
export interface IBatchCheckWalletItem {
  networkId: string;
  address: string;
}

export interface IBatchCheckWalletParams {
  items: IBatchCheckWalletItem[];
}

// Response is a map where key is "networkId:address" and value is boolean
export type IBatchCheckWalletResponse = Record<string, boolean>;

// Hardware records types
export interface IHardwareRecordHistoryItem {
  type: string;
  eventLabel: string;
  timestamp: string;
  descriptionLabel: string;
}

export interface IHardwareRecordItem {
  _id: string;
  orderNumber: string;
  itemUniqueId: string;
  inviteCode: string;
  inviteCodeRemark: string;
  orderAmount: string;
  orderAmountFiatValue: string;
  rebateAmount: string;
  rebateAmountFiatValue: string;
  token: {
    networkId: string;
    address: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
  status: string;
  statusLabel: string;
  orderPlacedAt: string;
  rewardConfirmedAt: string;
  rewardDistributedAt: string | null;
  refundedAt: string | null;
  history: IHardwareRecordHistoryItem[];
}

export interface IHardwareRecordsResponse {
  total: number;
  items: IHardwareRecordItem[];
  cursor?: string;
}

// Perps cumulative rewards response
export interface IPerpsCumulativeRewardsParams {
  timeRange?: EExportTimeRange;
  startTime?: number;
  endTime?: number;
  inviteCode?: string;
}

export interface IPerpsCumulativeRewardsResponse {
  undistributedReward: string;
  undistributedRewardFiatValue: string;
  totalReward: string;
  totalRewardFiatValue: string;
  totalVolume: string;
  totalVolumeFiatValue: string;
  totalFee: string;
  totalFeeFiatValue: string;
  invitedAddresses: number;
  walletCount: number;
  token: IRewardToken;
}

// Redemption code types
export interface IRedemptionCodeRedeemParams {
  code: string;
}

export interface IRedemptionCodeRedeemError {
  code: number;
  message: string;
  messageId?: string;
}

export interface IRedemptionCodeRedeemResponse {
  success: boolean;
  error?: IRedemptionCodeRedeemError;
  upgradeInfo?: {
    fromLevel?: number;
    toLevel?: number;
    fromLevelLabel?: string;
    toLevelLabel?: string;
    toLevelIcon?: string;
  };
}

// Redemption center records types
export interface IRedemptionRecordMetadata {
  previousLevel?: number;
  newLevel?: number;
}

export interface IRedemptionRecordItem {
  _id: string;
  type: string;
  code: string;
  metadata?: IRedemptionRecordMetadata;
  redeemedAt: string;
  title: string;
  description: string;
  status: 'success' | 'pending';
}

export interface IRedemptionRecordsResponse {
  total: number;
  items: IRedemptionRecordItem[];
}
