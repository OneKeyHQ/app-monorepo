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

export type StakingActivity = {
  nonce?: number;
  oldValue?: number;
  type: string;
  txid: string;
  amount: string;
  createdAt: number;
};
