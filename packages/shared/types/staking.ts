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

export type IAvailableAsset = {
  'name': 'string';
  'symbol': 'string';
  'logoURI': 'string';
  'apr': 'string';
  'networks': {
    'networkId': 'string';
    'name': 'string';
    'logoURI': 'string';
    'address': 'string';
  }[];
};
export type IAvailableAssetsResult = {
  'tokens': IAvailableAsset[];
};
