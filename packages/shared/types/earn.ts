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
  displayProfit: boolean;
  stakingWithApprove?: boolean;
  unstakeWithTx?: boolean;
  unstakeWithSignMessage?: boolean;
  withdrawWithTx?: boolean;
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
