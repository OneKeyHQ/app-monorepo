export enum EEarnProviderEnum {
  Lido = 'Lido',
  Everstake = 'Everstake',
  Babylon = 'Babylon',
}

export type ISupportedSymbol =
  | 'ETH'
  | 'MATIC'
  | 'SOL'
  | 'ATOM'
  | 'APT'
  | 'BTC'
  | 'SBTC';

interface IStakingFlowConfig {
  tokenAddress: string;
  displayProfit: boolean;
  stakingWithApprove?: boolean;
  withdrawWithTx?: boolean;
  withdrawWithSignMessage?: boolean;
  claimWithTx?: boolean;
  usePublicKey?: boolean;
}

interface IProviderConfig {
  supportedSymbols: ISupportedSymbol[];
  configs: {
    [key in ISupportedSymbol]?: IStakingFlowConfig;
  };
}

interface INetworkStakingConfig {
  providers: {
    [key in EEarnProviderEnum]?: IProviderConfig;
  };
}

export interface IStakingConfig {
  [networkId: string]: INetworkStakingConfig;
}
