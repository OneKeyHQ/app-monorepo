/* eslint-disable @typescript-eslint/ban-types */

export enum StakingRoutes {
  StakingAmount = 'StakingAmount',
  StakedETHOnKele = 'StakedETHOnKele',
  StakedETHOnLido = 'StakedETHOnLido',
  StakedMaticOnLido = 'StakedMaticOnLido',
  UnstakeAmount = 'UnstakeAmount',
  WithdrawAmount = 'WithdrawAmount',
  Feedback = 'Feedback',

  KeleEthStakeShouldUnderstand = 'KeleEthStakeShouldUnderstand',
  KeleEthUnstakeShouldUnderstand = 'KeleEthUnstakeShouldUnderstand',

  LidoEthStakeShouldUnderstand = 'LidoEthStakeShouldUnderStand',
  LidoMaticStakeShouldUnderstand = 'LidoMaticStakeShouldUnderstand',
  LidoEthUnstakeShouldUnderstand = 'LidoEthUnstakeShouldUnderStand',
  LidoEthUnstake = 'LidoEthUnstake',
  LidoEthUnstakeRoutes = 'LidoEthUnstakeRoutes',
  LidoUnstakeRoutes = 'LidoUnstakeRoutes',

  ETHPoolSelector = 'ETHPoolSelector',
  KeleStakingModeSelector = 'KeleStakingModeSelector',
  ETHStake = 'ETHStake',

  MaticStake = 'MaticStake',
  LidoMaticUnstake = 'LidoMaticUnstake',
  LidoMaticClaim = 'LidoMaticClaim',
}

export enum EthStakingSource {
  Kele = 'Kele',
  Lido = 'Lido',
}

export enum KeleStakingMode {
  normal = 'normal',
  fast = 'fast',
}

export type StakingRoutesParams = {
  [StakingRoutes.StakingAmount]: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.UnstakeAmount]: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.KeleEthUnstakeShouldUnderstand]: {
    networkId: string;
    accountId: string;
    readonly?: boolean;
  };
  [StakingRoutes.KeleEthStakeShouldUnderstand]: {
    networkId: string;
    accountId: string;
    amount: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.StakedETHOnKele]: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.WithdrawAmount]: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.Feedback]: {
    networkId: string;
    accountId: string;
  };
  [StakingRoutes.ETHPoolSelector]: {
    networkId: string;
    accountId: string;
    onSelector?: (name: EthStakingSource) => void;
  };
  [StakingRoutes.KeleStakingModeSelector]: {
    networkId: string;
    mode: KeleStakingMode;
    onSelector?: (name: KeleStakingMode) => void;
  };
  [StakingRoutes.LidoEthStakeShouldUnderstand]: {
    networkId: string;
    accountId: string;
    readonly?: boolean;
  };
  [StakingRoutes.LidoMaticStakeShouldUnderstand]: {
    networkId: string;
    accountId: string;
    readonly?: boolean;
  };
  [StakingRoutes.LidoEthUnstakeShouldUnderstand]: {
    networkId: string;
    accountId: string;
  };
  [StakingRoutes.LidoEthUnstake]: {
    networkId: string;
    accountId: string;
  };
  [StakingRoutes.LidoEthUnstakeRoutes]: {
    networkId: string;
    accountId: string;
    source: string;
    amount?: string;
    onSelector?: (name: string) => void;
  };
  [StakingRoutes.LidoUnstakeRoutes]: {
    networkId: string;
    accountId: string;
    source: string;
    amount?: string;
    onSelector?: (name: string) => void;
  };
  [StakingRoutes.StakedETHOnLido]: {
    networkId: string;
    accountId: string;
  };
  [StakingRoutes.StakedMaticOnLido]: {
    networkId: string;
    accountId: string;
  };
  [StakingRoutes.ETHStake]: {
    networkId: string;
    accountId: string;
    source?: EthStakingSource;
  };
  [StakingRoutes.MaticStake]: {
    networkId: string;
    accountId: string;
  };
  [StakingRoutes.LidoMaticUnstake]: {
    networkId: string;
    accountId: string;
  };
  [StakingRoutes.LidoMaticClaim]: {
    networkId: string;
    accountId: string;
  };
};

export type KeleDashboardGlobal = {
  contract: string;
  online_ratio: number;
  predicted_reward: number;
  retail_deposit_far: number;
  retail_min_amount: number;
  apr_detail: {
    basic: string;
    mev: string;
  };
  validator_alive_predicted_hour: number;
  withdraw_predicted_hour: number;
  validator_total: number;
};

export type StakingActivity = {
  nonce?: number;
  oldValue?: number;
  type: string;
  txid: string;
  amount: string;
  createdAt: number;
};

export type KeleUnstakeOverviewDTO = {
  retail_staked: string;
  retail_unstaking: string;
  whale_staked: string;
  whale_unstaking: string;
  estimate_use_sec: number;
  fast_fee_ratio: number;
};

export type KeleMinerOverview = {
  amount: {
    total_amount: number;
    staked_amount: number;
    staking_amount: number;
    ongoing_amount: number;
    withdrawable: string;
    retail_staked: string;
    retail_unstaking: string;
    whale_staked: string;
    whale_unstaking: string;
  };
  income: {
    total_reward: number;
    mev_total_reward: number;
    staked_days: number;
    apr: number;
  };
};

export type KeleWithdrawOverviewDTO = {
  balance: string;
  fee_free_threshold: string;
  user_fee: string;
  pay_addr: string;
};

export type KeleIncomeDTO = {
  date: string;
  reward: number;
  deposit?: number;
  balance: number;
};

export type KeleOpHistoryDTO = {
  transaction_id: string;
  amount: number;
  op_type: number;
  history_time: string;
  remain_time: number;
};

export type KeleGenericHistory = {
  type: 'income' | 'op';
  income?: KeleIncomeDTO;
  op?: KeleOpHistoryDTO;
  time: number;
};

export type KeleHttpResponse = {
  code: number;
  message: string;
  data: any;
};

export type EthStakingApr = {
  mainnet: {
    lido: number;
    kele: number;
  };
  testnet: {
    lido: number;
    kele: number;
  };
};

export interface LidoNFTStatus {
  isFinalized: boolean;
  isClaimed: boolean;
  owner: string;
  amountOfStETH: string;
  amountOfShares: string;
  timestamp: number;
  stETH: string;
  requestId: number;
}

export type LidoMaticNFTStatus = {
  nftId: number;
  claimable: boolean;
  maticAmount: string;
};

export type LidoMaticOverview = {
  balance?: string;
  stMaticAddress?: string;
  maticToStMaticRate?: string;
  nfts?: LidoMaticNFTStatus[];
};

export type LidoOverview = {
  total?: string;
  pending?: string;
  pendingNums?: number;
  balance?: string;
  withdrawal?: string;
  nftsBalance?: string;
  nfts?: LidoNFTStatus[];
};

export type TransactionStatus = 'pending' | 'failed' | 'canceled' | 'sucesss';
export type TransactionType =
  | 'lidoUnstake'
  | 'lidoStake'
  | 'lidoClaim'
  | 'lidoStakeMatic'
  | 'lidoUnstakeMatic'
  | 'lidoClaimMatic';

export interface Transaction {
  hash: string;
  type: string;
  networkId: string;
  accountId: string;
  addedTime: number;
  nonce?: number;
}

export interface TransactionDetails {
  hash: string;
  networkId: string;
  accountId: string;
  type: TransactionType;
  addedTime: number;
  confirmedTime?: number;
  nonce?: number;
  archive?: boolean;
}

export type KeleTransactionType = 'KeleStake' | 'KeleFastStake';

export interface KeleTransactionDetails {
  hash: string;
  networkId: string;
  accountId: string;
  type: KeleTransactionType;
  amount: string;
  addedTime: number;
  confirmedTime?: number;
  nonce?: number;
  archive?: boolean;
}
