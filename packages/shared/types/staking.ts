import type { IToken } from './token';

export type IAllowanceOverview = {
  allowance: string;
  allowanceParsed: string;
};

// export type IStakeTag = 'lido-eth' | 'lido-matic';
export type IStakeTag = string;

export enum EEarnLabels {
  Stake = 'Stake',
  Claim = 'Claim',
  Redeem = 'Redeem',
  Withdraw = 'Withdraw',
  Unknown = 'Unknown',
}

export type IStakingInfo = {
  protocol: string;
  protocolLogoURI?: string;
  label: EEarnLabels;
  tags: IStakeTag[]; // used for filtering
  send?: { amount: string; token: IToken };
  receive?: { amount: string; token: IToken };
  orderId?: string;
};

export enum EApproveType {
  Permit = 'permit',
  Legacy = 'legacy',
}

export type IStakeProviderInfo = {
  name: string;
  logoURI: string;
  website: string;
  // btc don't have apr
  aprWithoutFee?: string;
  poolFee: string;
  totalStaked: string;
  totalStakedFiatValue: string;
  totalFiatValue: string;
  minStakeAmount: string;
  maxStakeAmount: string;
  minUnstakeAmount?: number;
  minClaimableAmount?: string;
  isNative?: string;
  nextLaunchLeft?: string;

  lidoStTokenRate?: string;
  morphoTokenRate?: string;
  type?: 'native' | 'liquid' | 'lending';
  isStaking?: boolean;

  unstakingTime?: number;
  stakingTime?: number;

  receiptToken?: string;

  // native token only
  minTransactionFee?: string;

  // babylon
  minStakeTerm?: number;
  maxStakeTerm?: number;
  minStakeBlocks?: number;
  maxStakeBlocks?: number;
  unbondingTime?: number;
  stakingCap?: string;
  earnPoints?: boolean;
  stakeDisable?: boolean;
  buttonStake: boolean;
  buttonUnstake: boolean;
  alerts: string[];

  // morpho
  apys?: IRewardApys;
  maxUnstakeAmount?: string;
  vault?: string;
  vaultName?: string;
  url?: string;
  rewardUnit: IEarnRewardUnit;

  approveType?: EApproveType;

  liquidity?: string;
};

export type IStakeBaseParams = {
  accountId: string;
  networkId: string;
  amount: string;
  symbol: string;
  provider: string;

  term?: number; // Babylon
  feeRate?: number;
  signature?: string; // lido unstake
  deadline?: number; // lido unstake
  morphoVault?: string; // morpho vault
  approveType?: EApproveType;
  permitSignature?: string;
};

export type IWithdrawBaseParams = {
  accountId: string;
  networkId: string;
  amount: string;
  symbol: string;
  provider: string;

  identity?: string; // sol pubkey
  signature?: string; // lido unstake
  deadline?: number; // lido unstake
  morphoVault?: string; // morpho vault
  withdrawAll?: boolean;
};

export type IUnstakePushParams = {
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
  txId: string;
  unstakeTxHex: string;
};

export type IClaimRecordParams = {
  networkId: string;
  provider: string;
  symbol: string;
  accountId: string;
  identity: string;
};

export type IStakeClaimBaseParams = {
  accountId: string;
  networkId: string;
  symbol: string;
  vault: string;
  provider: string;
  amount?: string;
  identity?: string;
  claimTokenAddress?: string;
};

export type IStakeHistoryParams = {
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
  morphoVault?: string;
};

export type IStakeHistory = {
  txHash: string;
  title: string;
  type?: string;
  amount?: string;
  timestamp: number;
  tokenAddress: string;
  direction: 'receive' | 'send';
};

export type IStakeHistoriesResponse = {
  list: IStakeHistory[];
  tokenMap: Record<string, IToken>;
  nextKey?: string;
  network?: {
    networkId: string;
    name: string;
    logoURI: string;
  };
};

export enum EStakeTxType {
  EthEvertStake = 'eth-evert-stake',
  EthLido = 'eth-lido',
  BtcBabylon = 'btc-babylon',
}

export type IStakeTx =
  | IStakeTxBtcBabylon
  | IStakeTxEthEvertStake
  | IStakeTxEthLido
  | IStakeTxCosmosAmino;

export type IStakeTxResponse = {
  tx: IStakeTx;
  orderId: string;
};

// Babylon
export type IStakeTxBtcBabylon = {
  // type: EStakeTxType.BtcBabylon;
  psbtHex: string;
};

export type IStakeTxEthEvertStake = {
  // type: EStakeTxType.EthEvertStake;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  data: string;
};

export type IStakeTxEthLido = {
  // type: EStakeTxType.EthLido;
  to: string;
  value: string;
  data: string;
};

// Cosmos dapp interface signAmino
export type IStakeTxCosmosAmino = {
  readonly chain_id: string;
  readonly account_number: string;
  readonly sequence: string;
  fee: {
    amount: {
      denom: string;
      amount: string;
    }[];
    gas: string;
  };
  readonly msgs: {
    type: string;
    value: any;
  }[];
  readonly memo: string;
};

export type IEarnTokenItem = {
  balance: string;
  balanceParsed: string;
  fiatValue: string;
  price: string;
  price24h: string;
  info: IToken;
};

export type IStakeProtocolDetails = {
  staked: string;
  stakedFiatValue: string;
  available: string;
  active?: string;
  pendingInactive?: string;
  pendingActive?: string;
  claimable?: string;
  rewards?: string;
  earnings24h?: string;
  provider: IStakeProviderInfo;
  totalStaked?: string;
  totalStakedFiatValue?: string;
  stakingCap?: string;
  token: IEarnTokenItem;
  network?: {
    name: string;
  };
  updateFrequency: string;
  rewardToken: string;
  approveTarget?: string;
  earnHistoryEnable?: boolean;
  pendingActivatePeriod?: number;
  unstakingPeriod?: number;
  overflow?: string;
  rewardNum?: IEarnRewardNum;
  rewardAssets?: Record<string, IEarnTokenItem>;
};

export type IStakeProtocolListItem = {
  provider: IStakeProviderInfo;
  network: {
    networkId: string;
    name: string;
    logoURI: string;
  };
  isEarning: boolean;
};

export type IRewardApys = {
  // Base rates
  rate: string;
  netApy: string;
  performanceFee: string;

  // Time-based APYs
  dailyApy: string;
  dailyNetApy: string;
  weeklyNetApy: string;
  monthlyNetApy: string;

  // Token rewards
  rewards: Record<string, string>;
};

export type IBabylonPortfolioStatus =
  | 'active'
  | 'withdraw_requested'
  | 'claimable'
  | 'claimed'
  | 'local_pending_activation'; // local_pending_activation created by client side ;

export type IBabylonPortfolioItem = {
  txId: string;
  status: IBabylonPortfolioStatus;
  amount: string;
  fiatValue: string;
  startTime?: number;
  endTime?: number;
  lockBlocks: number;
  isOverflow: string;
};

export type IClaimableListItem = {
  id: string;
  amount: string;
  fiatValue?: string;
  isPending?: boolean;
  babylonExtra?: IBabylonPortfolioItem;
};

export type IClaimableListResponse = {
  token: IToken;
  network?: {
    networkId: string;
    name: string;
    logoURI: string;
  };
  items: IClaimableListItem[];
};

export interface IEarnAccountToken {
  orderIndex: number;
  networkId: string;
  name: string;
  symbol: string;
  logoURI: string;
  aprWithoutFee: string;
  profit: string;
  balance: string;
  balanceParsed: string;
  address: string;
  price: string;
  rewardUnit: IEarnRewardUnit;
}

export type IEarnAccountResponse = {
  claimableNum: number;
  totalFiatValue: string;
  earnings24h: string;
  tokens: IEarnAccountToken[];
  canClaim: boolean;
};

export type IEarnAccount = {
  tokens: IEarnAccountToken[];
  networkId: string;
  accountAddress: string;
  publicKey?: string;
};

export type IEarnAccountTokenResponse = {
  hasClaimableAssets?: boolean;
  totalFiatValue?: string;
  earnings24h?: string;
  accounts: IEarnAccount[];
  isOverviewLoaded?: boolean;
};

export type IEarnRewardUnit = 'APY' | 'APR';
export type IAvailableAsset = {
  name: string;
  symbol: string;
  logoURI: string;
  aprWithoutFee: string;
  tags: string[];
  networkId: string;
  rewardUnit: IEarnRewardUnit;
};

export interface IEarnAtomData {
  earnAccount?: Record<string, IEarnAccountTokenResponse>;
  availableAssets?: IAvailableAsset[];
}

export type IGetPortfolioParams = {
  networkId: string;
  accountId: string;
  provider: string;
  symbol: string;
};

export interface IInvestmentTokenInfo {
  uniqueKey: string;
  address: string;
  decimals: number;
  isNative: boolean;
  logoURI: string;
  name: string;
  symbol: string;
  totalSupply: string;
  riskLevel: number;
  networkId: string;
}

export type IEarnRewardNum = Record<
  string,
  {
    claimableNow: string;
    claimableNext: string;
  }
>;

export interface IInvestment {
  active: string;
  claimable: string;
  overflow: string;
  staked: string;
  stakedFiatValue: string;
  tokenInfo: IInvestmentTokenInfo;
  rewardNum?: IEarnRewardNum;
  vault?: string;
}
export interface IEarnInvestmentItem {
  name: string;
  logoURI: string;
  investment: IInvestment[];
}

export interface IEarnFAQListItem {
  question: string;
  answer: string;
}
export type IEarnFAQList = IEarnFAQListItem[];

export type IEarnEstimateAction = 'stake' | 'unstake' | 'claim';

export type IEarnUnbondingDelegationListItem = {
  amount: string;
  timestampLeft: number;
};

export type IEarnUnbondingDelegationList = IEarnUnbondingDelegationListItem[];

export type IEarnEstimateFeeResp = {
  coverFeeDays?: string;
  coverFeeSeconds?: string;
  feeFiatValue: string;
  token: {
    balance: string;
    balanceParsed: string;
    fiatValue: string;
    price: string;
    price24h: string;
    info: IToken;
  };
};

export interface IEarnBabylonTrackingItem {
  txId: string;
  action: 'stake' | 'claim';
  createAt: number;
  accountId: string;
  networkId: string;
  amount: string;
  minStakeTerm?: number;
}

export interface IBuildPermit2ApproveSignDataParams {
  networkId: string;
  provider: string;
  symbol: string;
  accountAddress: string;
  vault: string;
  amount: string;
}

export interface IEarnPermit2ApproveSignData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  message: {
    owner: string;
    spender: string;
    value: string;
    nonce: string;
    deadline: string;
    expiry?: string; // dai
  };
  primaryType: string;
  types: {
    EIP712Domain: {
      name: string;
      type: string;
    }[];
    Permit: {
      name: string;
      type: string;
    }[];
  };
}

export type IApproveConfirmFnParams = {
  amount: string;
  approveType?: EApproveType;
  permitSignature?: string;
};
