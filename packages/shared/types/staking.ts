import type { IToken } from './token';

export type IServerEvmTransaction = {
  data: string;
  value: string;
  to: string;
};

export type ILidoEthRequest = {
  id: number;
  amountOfStETH: string;
  isFinalized: boolean;
  isClaimed: boolean;
};

export type ILidoTokenItem = {
  price: string;
  balanceParsed: string;
  info: IToken;
};

export type ILidoEthOverview = {
  requests: ILidoEthRequest[];
  eth: ILidoTokenItem;
  stETH: ILidoTokenItem;
  minWithdrawAmount: string;
  minTransactionFee?: string;
};

export type ILidoMaticRequest = {
  id: number;
  claimable: boolean;
  amount: string;
};

export type ILidoMaticOverview = {
  matic: ILidoTokenItem;
  stMatic: ILidoTokenItem;
  matic2StMatic: string;
  requests: ILidoMaticRequest[];
};

export type IAllowanceOverview = {
  allowance: string;
  allowanceParsed: string;
};

export type IAprItem = {
  protocol: string;
  apr: number;
  logoUrl: string;
  displayName: string;
};

export type IAprToken = 'eth' | 'matic';

// export type IStakeTag = 'lido-eth' | 'lido-matic';
export type IStakeTag = string;

export enum EEarnLabels {
  Stake = 'Stake',
  Claim = 'Claim',
  Redeem = 'Redeem',
  Unknown = 'Unknown',
}

export type IStakingInfo = {
  protocol: string;
  label: EEarnLabels;
  tags: IStakeTag[]; // used for filtering
  send?: { amount: string; token: IToken };
  receive?: { amount: string; token: IToken };
};

export type ILidoHistorySendOrReceive = { amount: string; token: IToken };

export type ILidoHistoryItem = {
  label: string;
  send?: ILidoHistorySendOrReceive;
  receive?: ILidoHistorySendOrReceive;
  txHash: string;
  timestamp: number;
};

export type IStakeProviderInfo = {
  name: string;
  logoURI: string;
  website: string;
  apr: string;
  poolFee: string;
  totalStaked: string;
  minStakeAmount: string;
  maxStakeAmount: string;
  isNative: string;
  nextLaunchLeft?: string;
};

export type IStakeBaseParams = {
  accountId: string;
  networkId: string;
  amount: string;
  symbol: string;
  provider: string;

  signature?: string; // lido unstake
  deadline?: number; // lido unstake
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
};

export type IUnstakePushParams = {
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
  txId: string;
  unstakeTxHex: string;
};

export type IStakeClaimBaseParams = {
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
  amount?: string;
  identity?: string;
};

export type IStakeHistoryParams = {
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
};

export type IStakeHistory = {
  txId: string;
  title: string;
  type: string;
  amount: string;
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

export type IStakeTxResponse =
  | IStakeTxBtcBabylon
  | IStakeTxEthEvertStake
  | IStakeTxEthLido;

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

export type IStakeProtocolDetails = {
  staked: string;
  stakedFiatValue: string;
  available: string;
  pendingInactive?: string;
  pendingActive?: string;
  claimable?: string;
  earnings24h?: string;
  provider: IStakeProviderInfo;
  token: {
    balance: string;
    balanceParsed: string;
    fiatValue: string;
    price: string;
    price24h: string;
    info: IToken;
  };
  updateFrequency: string;
  rewardToken: string;
  approveTarget?: string;
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

export type IClaimableListResponse = {
  token: IToken;
  network?: {
    networkId: string;
    name: string;
    logoURI: string;
  };
  items: { id: string; amount: string }[];
};

export interface IEarnAccountToken {
  name: string;
  symbol: string;
  logoURI: string;
  apr: string;
  profit: string;
  balance: string;
  balanceParsed: string;
  address: string;
  price: string;
}

export type IEarnAccountResponse = {
  claimableNum: number;
  totalFiatValue: string;
  earnings24h: string;
  tokens: IEarnAccountToken[];
};

export type IEarnAccount = {
  earn: IEarnAccountResponse;
  networkId: string;
  accountAddress: string;
};

export type IAvailableAsset = {
  name: string;
  symbol: string;
  logoURI: string;
  apr: string;
  tags: string[];
  networkId: string;
};

export interface IEarnAtomData {
  accounts?: IEarnAccount[];
  availableAssets?: IAvailableAsset[];
}

export type IPortfolioItem = {
  txId: string;
  status: string;
  amount: string;
  fiatValue: string;
  startTime?: number;
  endTime?: number;
  lockBlocks: number;
  isOverflow: string;
};

export type IGetPortfolioParams = {
  networkId: string;
  accountId: string;
  provider: string;
  symbol: string;
};
