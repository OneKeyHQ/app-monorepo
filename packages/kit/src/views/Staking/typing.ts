export enum StakingRoutes {
  StakingAmount = 'StakingAmount',
  StakingETHNotes = 'StakingETHNotes',
  StakedETHOnKele = 'StakedETHOnKele',
}

export type StakingRoutesParams = {
  [StakingRoutes.StakingAmount]: {
    networkId: string;
    tokenIdOnNetwork?: string;
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
};

export type KeleETHStakingState = {
  total?: number;
  staked?: number;
  staking?: number;
};

export type KeleDashboardGlobal = {
  contract: string;
  online_ratio: number;
  predicted_reward: number;
  retail_deposit_far: number;
  validator_alive_predicted_hour: number;
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
