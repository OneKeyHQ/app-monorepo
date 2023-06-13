/* eslint-disable @typescript-eslint/ban-types */

export enum StakingRoutes {
  StakingAmount = 'StakingAmount',
  StakedETHOnKele = 'StakedETHOnKele',
  StakedETHOnLido = 'StakedETHOnLido',
  UnstakeAmount = 'UnstakeAmount',
  WithdrawAmount = 'WithdrawAmount',
  Feedback = 'Feedback',

  KeleEthStakeShouldUnderstand = 'KeleEthStakeShouldUnderstand',
  KeleEthUnstakeShouldUnderstand = 'KeleEthUnstakeShouldUnderstand',

  LidoEthStakeShouldUnderstand = 'LidoEthStakeShouldUnderStand',
  LidoEthUnstakeShouldUnderstand = 'LidoEthUnstakeShouldUnderStand',
  LidoEthUnstake = 'LidoEthUnstake',
  LidoEthUnstakeRoutes = 'LidoEthUnstakeRoutes',

  ETHPoolSelector = 'ETHPoolSelector',
  ETHStake = 'ETHStake',
}

export enum EthStakingSource {
  Kele = 'Kele',
  Lido = 'Lido',
}

export type StakingRoutesParams = {
  [StakingRoutes.StakingAmount]: {
    networkId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.UnstakeAmount]: {
    networkId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.KeleEthUnstakeShouldUnderstand]: {
    networkId: string;
    readonly?: boolean;
  };
  [StakingRoutes.KeleEthStakeShouldUnderstand]: {
    networkId: string;
    amount: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.StakedETHOnKele]: {
    networkId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.WithdrawAmount]: {
    networkId: string;
    tokenIdOnNetwork?: string;
  };
  [StakingRoutes.Feedback]: {
    networkId: string;
  };
  [StakingRoutes.ETHPoolSelector]: {
    isTestnet: boolean;
    onSelector?: (name: EthStakingSource) => void;
  };
  [StakingRoutes.LidoEthStakeShouldUnderstand]: {
    readonly?: boolean;
  };
  [StakingRoutes.LidoEthUnstakeShouldUnderstand]: {};
  [StakingRoutes.LidoEthUnstake]: {};
  [StakingRoutes.LidoEthUnstakeRoutes]: {
    source: string;
    amount?: string;
    onSelector?: (name: string) => void;
  };
  [StakingRoutes.StakedETHOnLido]: {};
  [StakingRoutes.ETHStake]: {
    source: EthStakingSource;
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
export type TransactionType = 'lidoUnstake' | 'lidoStake' | 'lidoClaim';

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
