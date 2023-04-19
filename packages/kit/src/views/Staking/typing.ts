export enum StakingRoutes {
  StakingAmount = 'StakingAmount',
  StakingETHNotes = 'StakingETHNotes',
  StakedETHOnKele = 'StakedETHOnKele',
  UnstakeAmount = 'UnstakeAmount',
  UnstakeKeleETHNotes = 'UnstakeKeleETHNotes',
  WithdrawAmount = 'WithdrawAmount',
  Feedback = 'Feedback',
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
  [StakingRoutes.UnstakeKeleETHNotes]: {
    networkId: string;
    readonly?: boolean;
  };
  [StakingRoutes.StakingETHNotes]: {
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
